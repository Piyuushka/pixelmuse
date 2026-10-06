import { NextResponse } from 'next/server';
import { triggerAlertForChild } from '@/lib/db/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { childEmail, alertType, customMessage, coords } = body;

    if (!childEmail || !alertType) {
      return NextResponse.json(
        { error: 'Child email and alertType are required.' },
        { status: 400 }
      );
    }

    const alert = triggerAlertForChild(childEmail, alertType, customMessage, coords);

    return NextResponse.json({
      message: `Safety alert [${alertType}] sent successfully to linked parent and recorded in database.`,
      alert,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to trigger parental safety alert' },
      { status: 500 }
    );
  }
}
