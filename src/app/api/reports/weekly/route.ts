import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db/userStore';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    const { searchParams } = new URL(request.url);
    const dependentId = searchParams.get('dependentId') || session.userId;

    const user = findUserById(dependentId);
    if (!user) return apiError('User not found', 'NOT_FOUND', 404);

    const pastWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const trips = (user.tripHistory || []);
    const alerts = (user.parentAlerts || []);

    const totalDistanceMeters = trips.reduce((acc, t) => acc + (t.distanceMeters || 0), 0);
    const totalDurationMinutes = trips.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);

    return apiSuccess({
      success: true,
      report: {
        dependentName: user.name,
        dependentEmail: user.email,
        period: {
          from: pastWeekStart,
          to: new Date().toISOString(),
        },
        summary: {
          totalTrips: trips.length,
          totalDistanceKm: (totalDistanceMeters / 1000).toFixed(1),
          totalWalkingHours: (totalDurationMinutes / 60).toFixed(1),
          safeArrivalRate: '100%',
          alertsCount: alerts.length,
          sosCount: alerts.filter(a => a.type === 'SOS').length,
          deviationsCount: alerts.filter(a => a.type === 'ROUTE_DEVIATION').length,
        },
        trips,
        alerts,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
