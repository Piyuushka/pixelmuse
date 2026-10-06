import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { generatePairingCode } from '@/lib/db/pairingStore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { code, expiresAt } = await generatePairingCode(session.userId);

    return NextResponse.json({
      success: true,
      pairingCode: code,
      expiresAt,
      message: 'Fresh 6-digit pairing code generated.',
    });
  } catch (error: any) {
    console.error('Failed to generate pairing code:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
