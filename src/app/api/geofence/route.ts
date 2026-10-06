import { NextResponse, type NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db/userStore';
import type { GeofenceZone } from '@/lib/geofenceEngine';

// In-memory store for geofences per link/user
const geofenceStore = new Map<string, GeofenceZone[]>();

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId') || session.userId;

    const zones = geofenceStore.get(linkId) || [
      {
        id: 'zone_home_demo',
        linkId,
        name: 'Home Safe Zone',
        center: { lat: 19.0760, lng: 72.8777 },
        radiusMeters: 500,
        type: 'SAFE',
        activeCurfewStart: '22:00',
        activeCurfewEnd: '06:00',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'zone_school_demo',
        linkId,
        name: 'School / College Zone',
        center: { lat: 19.0820, lng: 72.8830 },
        radiusMeters: 300,
        type: 'SAFE',
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({ success: true, linkId, zones });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch geofences' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, center, radiusMeters = 500, type = 'SAFE', activeCurfewStart, activeCurfewEnd, linkId } = body;

    if (!name || !center || typeof center.lat !== 'number' || typeof center.lng !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid geofence name or center coordinates' }, { status: 400 });
    }

    const targetLinkId = linkId || session.userId;
    const existing = geofenceStore.get(targetLinkId) || [];

    const newZone: GeofenceZone = {
      id: `gf_${Date.now()}`,
      linkId: targetLinkId,
      name,
      center,
      radiusMeters,
      type,
      activeCurfewStart,
      activeCurfewEnd,
      createdAt: new Date().toISOString(),
    };

    existing.push(newZone);
    geofenceStore.set(targetLinkId, existing);

    return NextResponse.json({
      success: true,
      message: `Geofence zone '${name}' created successfully.`,
      zone: newZone,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create geofence' }, { status: 500 });
  }
}
