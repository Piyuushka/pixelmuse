import { NextRequest, NextResponse } from 'next/server';
import { ssePublisher } from '@/lib/ssePublisher';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') || undefined;
  const clientId = `sse-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  let unregister: (() => void) | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Register with SSEPublisher
      unregister = ssePublisher.registerClient({
        id: clientId,
        sessionId,
        send: (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // Stream closed
          }
        },
        close: () => {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        },
      });

      // Heartbeat comment frame every 15 seconds to keep HTTP connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15000);
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (unregister) unregister();
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, barrier, activeBarriers } = body;

    if (action === 'scan_proximity' && activeBarriers) {
      const events = ssePublisher.scanAllActiveSessions(activeBarriers);
      return NextResponse.json({
        success: true,
        emittedEventCount: events.length,
        events,
      });
    }

    return NextResponse.json({
      success: true,
      activeClientCount: ssePublisher.clientCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to process SSE publisher request' },
      { status: 500 }
    );
  }
}
