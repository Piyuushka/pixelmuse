import { NextRequest, NextResponse } from 'next/server';
import { triggerActiveBarrierRecalculation } from '@/lib/routeRecalculator';
import { generateGraphHopperCustomModel, generateOsrmSpeedConfig } from '@/lib/routingEngine';
import { sessionRegistry } from '@/lib/navigationSessionRegistry';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barrier, allActiveBarriers } = body;

    if (!barrier) {
      return NextResponse.json(
        { error: 'Missing barrier payload in request body' },
        { status: 400 }
      );
    }

    const reroutes = await triggerActiveBarrierRecalculation(barrier, {
      activeBarriers: allActiveBarriers,
      autoUpdateSession: true,
    });

    return NextResponse.json({
      success: true,
      affectedSessionCount: reroutes.length,
      reroutes,
    });
  } catch (error) {
    console.error('[API Recalculate Error]', error);
    return NextResponse.json(
      { error: 'Failed to recalculate routes for active sessions' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const activeSessions = sessionRegistry.getAllActiveSessions();
  const graphhopperModel = generateGraphHopperCustomModel([]);
  const osrmConfig = generateOsrmSpeedConfig([]);

  return NextResponse.json({
    activeSessionCount: activeSessions.length,
    activeSessions: activeSessions.map(s => ({
      sessionId: s.sessionId,
      userId: s.userId,
      remainingDistanceMeters: s.remainingDistanceMeters,
      currentPositionIndex: s.currentPositionIndex,
    })),
    engineConfigs: {
      graphhopper: graphhopperModel,
      osrm: osrmConfig,
    },
  });
}
