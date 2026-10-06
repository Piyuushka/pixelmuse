import { NextRequest, NextResponse } from 'next/server';
import {
  findUserByEmail,
  sanitizeUser,
  getActiveLinksForGuardian,
  getPendingLinksForGuardian,
  getLinksForDependent,
  getActiveTrip,
  updateChildTripTelemetry,
  triggerAlertForChild,
} from '@/lib/db/userStore';

/**
 * GET /api/parental/dashboard
 *
 * Returns the guardian's dashboard data: profile, all ACCEPTED dependent
 * profiles, pending outgoing invites, and the guardian's alert log.
 *
 * RBAC: Only returns dependent data for users who have ACCEPTED a GuardianLink
 *       with the requesting guardianEmail. Legacy linkedChildrenEmails entries
 *       are also included for backward compatibility.
 *
 * Query params:
 *   email: string  — The guardian's email address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guardianEmail = searchParams.get('email');

    if (!guardianEmail) {
      return NextResponse.json(
        { error: 'Guardian email parameter is required.' },
        { status: 400 }
      );
    }

    const guardian = findUserByEmail(guardianEmail);
    if (!guardian) {
      return NextResponse.json({ error: 'Guardian account not found.' }, { status: 404 });
    }

    // New model: fetch dependents via GuardianLink
    const acceptedLinks = getActiveLinksForGuardian(guardianEmail);
    const pendingLinks = getPendingLinksForGuardian(guardianEmail);

    // Also fetch dependent links where THIS user is the dependent (for settings page)
    const incomingLinks = getLinksForDependent(guardianEmail);

    // Build dependent profiles — each gated by an ACCEPTED link
    const linkedChildren = acceptedLinks
      .map(link => {
        const dependent = findUserByEmail(link.dependentEmail);
        if (!dependent) return null;

        const safeDependent = sanitizeUser(dependent);
        const activeTrip = getActiveTrip(link.dependentEmail);

        return {
          ...safeDependent,
          linkId: link.id,
          consentGrantedAt: link.consentGrantedAt,
          // Live trip data from new Trip model
          activeGuardianTrip: activeTrip,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      parent: sanitizeUser(guardian),
      linkedChildren,
      acceptedLinks,
      pendingLinks,
      incomingLinks,           // Links where guardian is the dependent
      alerts: guardian.parentAlerts || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch guardian dashboard data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parental/dashboard
 *
 * Updates trip telemetry for a dependent (legacy support).
 * Also supports triggering alerts.
 *
 * Body variants:
 *   { action: 'update_telemetry', childEmail, tripData }
 *   { action: 'trigger_alert', childEmail, alertType, customMessage?, coords? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, childEmail, tripData, alertType, customMessage, coords } = body;

    if (!childEmail) {
      return NextResponse.json(
        { error: 'childEmail is required.' },
        { status: 400 }
      );
    }

    if (action === 'trigger_alert') {
      if (!alertType) {
        return NextResponse.json({ error: 'alertType is required.' }, { status: 400 });
      }
      const alert = triggerAlertForChild(childEmail, alertType, customMessage, coords);
      return NextResponse.json({
        message: `Alert [${alertType}] triggered and recorded.`,
        alert,
      });
    }

    // Default: update trip telemetry (legacy)
    const updatedChild = updateChildTripTelemetry(childEmail, tripData);
    return NextResponse.json({
      message: 'Trip telemetry updated successfully.',
      activeTrip: updatedChild.activeTrip,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Dashboard operation failed' },
      { status: 500 }
    );
  }
}
