import { NextRequest } from 'next/server';
import { guardianBroadcaster, GuardianEvent } from '@/lib/guardianBroadcaster';
import { findUserByEmail, getActiveLinksForGuardian } from '@/lib/db/userStore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/guardian/stream
 *
 * Server-Sent Events (SSE) endpoint for a guardian to receive live telemetry
 * from their dependent(s).
 *
 * Query params:
 *   guardianEmail: string  — The guardian's email address (used for RBAC routing)
 *
 * Stream events:
 *   CONNECTED       — Initial handshake sent immediately on connect
 *   LOCATION_UPDATE — Dependent GPS ping
 *   ROUTE_DEVIATION — Dependent deviated >150m from route
 *   PROLONGED_STOP  — Dependent stationary >5 minutes
 *   SOS_TRIGGER     — Dependent pressed panic button
 *   TRIP_STARTED    — Dependent started a new trip
 *   TRIP_ENDED      — Dependent completed trip or SOS resolved
 *
 * SSE Frame format:
 *   event: <type>\n
 *   data: <JSON>\n\n
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const guardianEmail = searchParams.get('guardianEmail');

  if (!guardianEmail) {
    return new Response(
      JSON.stringify({ error: 'guardianEmail query parameter is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const guardian = findUserByEmail(guardianEmail);
  if (!guardian) {
    return new Response(
      JSON.stringify({ error: 'Guardian account not found.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate guardian has at least one active link
  const activeLinks = getActiveLinksForGuardian(guardianEmail);

  let unsubscribe: (() => void) | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(event: GuardianEvent) {
        try {
          const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream closed
        }
      }

      // Send connected handshake immediately
      const connectedEvent: GuardianEvent = {
        id: `ge_conn_${Date.now()}`,
        type: 'CONNECTED',
        dependentEmail: '',
        dependentName: '',
        timestamp: new Date().toISOString(),
        payload: {
          guardianName: guardian.name,
          activeLinkCount: activeLinks.length,
          dependents: activeLinks.map(l => ({
            email: l.dependentEmail,
            consentGrantedAt: l.consentGrantedAt,
          })),
        },
        message: `Guardian stream connected. Monitoring ${activeLinks.length} dependent(s).`,
      };
      try {
        controller.enqueue(
          encoder.encode(`event: CONNECTED\ndata: ${JSON.stringify(connectedEvent)}\n\n`)
        );
      } catch {/* already closed */}

      // Subscribe to guardian broadcaster
      unsubscribe = guardianBroadcaster.subscribeForGuardian(guardianEmail, sendEvent);

      // Heartbeat comment frame every 20s to keep HTTP connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': guardian-heartbeat\n\n'));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 20_000);
    },

    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
