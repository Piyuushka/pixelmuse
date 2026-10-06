import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { locationBroadcaster } from '@/lib/locationBroadcaster';
import { guardianBroadcaster, GuardianEvent } from '@/lib/guardianBroadcaster';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dependentEmail = searchParams.get('dependentEmail');

  const encoder = new TextEncoder();
  let cleanupFns: Array<() => void> = [];

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected message
      const initialPayload = JSON.stringify({
        type: 'CONNECTED',
        timestamp: new Date().toISOString(),
        userEmail: session.email,
        dependentEmail: dependentEmail || null,
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${initialPayload}\n\n`));

      // Send latest location if requested and available
      if (dependentEmail) {
        const latest = locationBroadcaster.getLatestLocation(dependentEmail);
        const history = locationBroadcaster.getHistory(dependentEmail);
        const activeSOS = locationBroadcaster.getActiveSOS(dependentEmail);

        if (latest) {
          controller.enqueue(
            encoder.encode(
              `event: location\ndata: ${JSON.stringify({ type: 'LOCATION_UPDATE', data: latest, history })}\n\n`
            )
          );
        }

        if (activeSOS) {
          controller.enqueue(
            encoder.encode(
              `event: sos\ndata: ${JSON.stringify({ type: 'SOS_ALERT', data: activeSOS })}\n\n`
            )
          );
        }

        // Subscribe to location updates for this dependent
        const unsubLoc = locationBroadcaster.subscribeToUser(dependentEmail, (event) => {
          try {
            controller.enqueue(
              encoder.encode(`event: location\ndata: ${JSON.stringify(event)}\n\n`)
            );
          } catch {
            // Stream closed
          }
        });
        cleanupFns.push(unsubLoc);
      }

      // Also listen to guardian broadcaster events if user is caregiver
      const unsubGuardian = guardianBroadcaster.subscribeForGuardian(session.email, (event: GuardianEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`event: guardian\ndata: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      });
      cleanupFns.push(unsubGuardian);

      // Listen to SOS broadcasts
      const unsubSOS = locationBroadcaster.subscribeToSOS((event) => {
        try {
          if (!dependentEmail || event.data.userEmail.toLowerCase() === dependentEmail.toLowerCase()) {
            controller.enqueue(
              encoder.encode(`event: sos\ndata: ${JSON.stringify(event)}\n\n`)
            );
          }
        } catch {
          // Stream closed
        }
      });
      cleanupFns.push(unsubSOS);

      // Heartbeat every 15s to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      cleanupFns.push(() => clearInterval(heartbeatInterval));
    },
    cancel() {
      cleanupFns.forEach(fn => {
        try {
          fn();
        } catch {}
      });
      cleanupFns = [];
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
