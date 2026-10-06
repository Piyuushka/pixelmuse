import { z } from 'zod';

// ============================================================================
// Auth & Profile Schemas
// ============================================================================

export const signupSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name required'),
  role: z.enum(['USER', 'CAREGIVER']),
  phone: z.string().optional(),
  language: z.string().default('en'),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  mobilityProfile: z
    .object({
      persona: z.enum(['wheelchair', 'older-adult', 'low-vision', 'caregiver', 'none']).default('wheelchair'),
      requireStepFree: z.boolean().default(true),
      maxSlopePercent: z.number().min(0).max(30).default(5),
      needTactilePaving: z.boolean().default(false),
      needAudioPrompts: z.boolean().default(true),
    })
    .optional(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  language: z.string().optional(),
  dateOfBirth: z.string().optional(),
  onboardingComplete: z.boolean().optional(),
  mobilityProfile: z
    .object({
      persona: z.enum(['wheelchair', 'older-adult', 'low-vision', 'caregiver', 'none']).optional(),
      requireStepFree: z.boolean().optional(),
      maxSlopePercent: z.number().min(0).max(30).optional(),
      needTactilePaving: z.boolean().optional(),
      needAudioPrompts: z.boolean().optional(),
    })
    .optional(),
});

// ============================================================================
// Pairing Schemas
// ============================================================================

export const pairingClaimSchema = z.object({
  code: z
    .string()
    .min(6, 'Pairing code must be 6 digits')
    .max(7, 'Invalid code format')
    .regex(/^[0-9-]+$/, 'Pairing code must contain digits only'),
});

export const pairingRespondSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

// ============================================================================
// Location Schemas
// ============================================================================

export const singleLocationSchema = z.object({
  lat: z.number().min(-90).max(90, 'Invalid latitude range'),
  lng: z.number().min(-180).max(180, 'Invalid longitude range'),
  accuracy_m: z.number().min(0).default(5),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  battery_pct: z.number().min(0).max(100).nullable().optional(),
  recorded_at: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Invalid ISO timestamp',
  }),
});

export const locationPingSchema = z.union([
  singleLocationSchema,
  z.object({
    locations: z.array(singleLocationSchema).min(1, 'At least 1 location point required'),
  }),
]);

export const locationHistoryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  page: z.coerce.number().min(1).default(1),
});

// ============================================================================
// SOS Schemas
// ============================================================================

export const sosTriggerSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().optional().default(5),
  battery_pct: z.number().min(0).max(100).optional(),
  is_test: z.boolean().default(true),
  idempotency_key: z.string().optional(),
  note: z.string().optional(),
});

export const sosActionSchema = z.object({
  note: z.string().optional(),
});

// ============================================================================
// Safety Controls & Geofences Schemas
// ============================================================================

export const geofenceSchema = z.object({
  dependent_id: z.string().uuid('Valid dependent ID required'),
  name: z.string().min(2, 'Geofence name required'),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  radius_m: z.number().min(50).max(10000, 'Radius must be between 50m and 10km'),
  active_from: z.string().optional(), // HH:MM:SS
  active_to: z.string().optional(),   // HH:MM:SS
  notify_on: z.enum(['ENTER', 'EXIT', 'BOTH']).default('BOTH'),
});

export const checkinSchema = z.object({
  message: z.string().default('I reached safely.'),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const checkinRequestSchema = z.object({
  dependent_id: z.string().uuid(),
  custom_prompt: z.string().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  device_label: z.string().optional(),
});
