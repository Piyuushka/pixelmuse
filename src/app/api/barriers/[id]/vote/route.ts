import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { voteBarrier, checkRateLimit } from '@/lib/db/barrierService';
import { getSessionFromRequest } from '@/lib/auth';

const VoteActionSchema = z.object({
  action: z.enum(['confirm', 'dispute', 'fixed']),
  user_id: z.string().optional(),
});

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: barrierId } = await params;
    if (!barrierId) {
      return NextResponse.json({ error: 'Barrier ID is required' }, { status: 400 });
    }

    // 1. Identify Client (User ID or IP)
    const session = await getSessionFromRequest(request);
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous-ip';

    // 2. Sliding-Window Rate Limiting (max 15 votes/min)
    const rateLimitKey = session?.userId ? `user:${session.userId}` : `ip:${ip}`;
    const withinLimit = checkRateLimit(rateLimitKey, 15, 60000);
    if (!withinLimit) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please wait a minute before submitting further community votes.',
        },
        { status: 429 }
      );
    }

    // 3. Parse and Validate Body with Zod
    const body = await request.json().catch(() => ({}));
    const validation = VoteActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid vote payload. Expected action: confirm | dispute | fixed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { action } = validation.data;
    const voterId = session?.userId || validation.data.user_id || ip;

    // 4. Execute Vote via Service (enforces 1 vote per user per report)
    try {
      const result = await voteBarrier({
        barrier_id: barrierId,
        action,
        user_id: voterId,
        ip_address: ip,
      });

      return NextResponse.json({
        success: true,
        barrier: result.barrier,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        statusChanged: result.statusChanged,
        message: result.statusChanged
          ? `Vote registered. Status promoted to ${result.newStatus}.`
          : `Vote registered successfully.`,
      });
    } catch (err: any) {
      if (err.message?.includes('already voted')) {
        return NextResponse.json(
          {
            error: 'You have already voted on this barrier report.',
          },
          { status: 409 }
        );
      }
      if (err.message?.includes('not found')) {
        return NextResponse.json({ error: 'Barrier report not found' }, { status: 404 });
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[API /api/barriers/[id]/vote] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while processing vote' },
      { status: 500 }
    );
  }
}
