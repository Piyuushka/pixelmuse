import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { geofenceSchema } from '@/lib/validations/schemas';
import { apiSuccess, apiError, handleApiError } from '@/lib/apiResponse';

interface GeofenceRecord {
  id: string;
  owner_caregiver_id: string;
  dependent_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  notify_on: 'ENTER' | 'EXIT' | 'BOTH';
  created_at: string;
}

// In-memory geofences store
const geofencesStore: GeofenceRecord[] = [
  {
    id: 'geo_1',
    owner_caregiver_id: 'usr_demo_caregiver',
    dependent_id: 'usr_demo_user',
    name: 'Home & Neighborhood Safe Zone',
    center_lat: 18.9322,
    center_lng: 72.8264,
    radius_m: 300,
    notify_on: 'BOTH',
    created_at: new Date().toISOString(),
  },
  {
    id: 'geo_2',
    owner_caregiver_id: 'usr_demo_caregiver',
    dependent_id: 'usr_demo_user',
    name: 'School / Therapy Center',
    center_lat: 18.9398,
    center_lng: 72.8355,
    radius_m: 200,
    notify_on: 'BOTH',
    created_at: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    return apiSuccess({ success: true, geofences: geofencesStore });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return apiError('Unauthorized', 'UNAUTHORIZED', 401);

    if (session.role !== 'CAREGIVER') {
      return apiError('Only caregivers can configure geofences', 'FORBIDDEN', 403);
    }

    const body = await request.json();
    const validated = geofenceSchema.parse(body);

    const newGeofence: GeofenceRecord = {
      id: `geo_${Date.now()}`,
      owner_caregiver_id: session.userId,
      dependent_id: validated.dependent_id,
      name: validated.name,
      center_lat: validated.center_lat,
      center_lng: validated.center_lng,
      radius_m: validated.radius_m,
      notify_on: validated.notify_on,
      created_at: new Date().toISOString(),
    };

    geofencesStore.push(newGeofence);

    return apiSuccess({
      success: true,
      geofence: newGeofence,
      message: 'Geofence safe zone created.',
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
