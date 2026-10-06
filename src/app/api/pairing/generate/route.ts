import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { generatePairingCode } from '@/lib/db/pairingStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let force = false;
    try {
      const body = await request.json();
      if (body && typeof body.force === 'boolean') {
        force = body.force;
      }
    } catch {
      // Body may be empty, default force = false
    }

    const { code, expiresAt } = await generatePairingCode(session.userId, force);

    return NextResponse.json({
      success: true,
      pairingCode: code,
      expiresAt,
      message: force ? 'Fresh 6-digit pairing code generated.' : 'Active 6-digit pairing code retrieved.',
    });
  } catch (error: any) {
    console.error('Failed to generate pairing code:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
