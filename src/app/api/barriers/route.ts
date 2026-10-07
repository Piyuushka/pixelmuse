import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBarriers,
  createBarrier,
  BarrierCategory,
  BarrierStatus,
  CreateBarrierInput,
} from '@/lib/db/barrierService';
import { getSessionFromRequest } from '@/lib/auth';

// ============================================================
// ZOD VALIDATION SCHEMAS
// ============================================================

const ValidCategoryEnum = z.enum([
  'stairs',
  'broken_footpath',
  'steep_road',
  'blocked_ramp',
  'inaccessible_entrance',
  'poor_lighting',
  'temporary_obstacle',
  'elevator_outage',
]);

const ValidStatusEnum = z.enum([
  'UNVERIFIED',
  'COMMUNITY_VERIFIED',
  'RESOLVED',
  'DISPUTED',
  'EXPIRED',
]);

const CreateBarrierSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(140),
  category: ValidCategoryEnum,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  location_name: z.string().optional(),
  micro_location: z.string().optional(),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
  estimated_resolution_time: z.string().optional(),
  photo_url: z.string().optional(),
  user_id: z.string().optional(),
});

// ============================================================
// GET /api/barriers
// Query Params:
// - bbox: minLng,minLat,maxLng,maxLat (e.g. 72.82,19.00,72.86,19.05)
// - category: BarrierCategory
// - status: BarrierStatus
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bboxParam = searchParams.get('bbox');
    const categoryParam = searchParams.get('category');
    const statusParam = searchParams.get('status');
    const includeExpired = searchParams.get('include_expired') === 'true';

    let parsedBbox: [number, number, number, number] | undefined = undefined;

    if (bboxParam) {
      const parts = bboxParam.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        parsedBbox = [parts[0], parts[1], parts[2], parts[3]];
      } else {
        return NextResponse.json(
          {
            error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat (e.g. 72.82,19.00,72.86,19.05)',
          },
          { status: 400 }
        );
      }
    }

    let parsedCategory: BarrierCategory | undefined = undefined;
    if (categoryParam) {
      const catCheck = ValidCategoryEnum.safeParse(categoryParam);
      if (catCheck.success) {
        parsedCategory = catCheck.data;
      }
    }

    let parsedStatus: BarrierStatus | undefined = undefined;
    if (statusParam) {
      const statusCheck = ValidStatusEnum.safeParse(statusParam);
      if (statusCheck.success) {
        parsedStatus = statusCheck.data;
      }
    }

    const barriers = await getBarriers({
      bbox: parsedBbox,
      category: parsedCategory,
      status: parsedStatus,
      includeExpired,
    });

    return NextResponse.json({
      success: true,
      count: barriers.length,
      barriers,
    });
  } catch (err: any) {
    console.error('[API /api/barriers GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while fetching barriers' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST /api/barriers
// Handles JSON or multipart/form-data with optional photo upload
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    const contentType = request.headers.get('content-type') || '';

    let payload: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawData: Record<string, any> = {};

      for (const [key, value] of formData.entries()) {
        if (key === 'photo' && typeof value === 'object' && value instanceof File) {
          // If a file is uploaded, convert to data URL or save
          const arrayBuffer = await value.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          rawData.photo_url = `data:${value.type || 'image/jpeg'};base64,${base64}`;
        } else {
          rawData[key] = value;
        }
      }
      payload = rawData;
    } else {
      payload = await request.json();
    }

    // Attach authenticated user_id if present
    if (!payload.user_id && session?.userId) {
      payload.user_id = session.userId;
    }

    // Validate with Zod
    const validation = CreateBarrierSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Call service to create or cluster merge
    const result = await createBarrier(validatedData as CreateBarrierInput);

    return NextResponse.json(
      {
        success: true,
        barrier: result.barrier,
        isClustered: result.isClustered,
        rerouteNotice: result.rerouteNotice,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API /api/barriers POST] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while creating barrier' },
      { status: 500 }
    );
  }
}
