import { NextRequest } from 'next/server';
import { apiSuccess } from '@/lib/apiResponse';

export const INDIA_EMERGENCY_HOTLINES = [
  { number: '112', label: 'National Emergency', desc: 'All-in-one Emergency Helpline', category: 'General' },
  { number: '100', label: 'Police', desc: 'State Police Command Center', category: 'Police' },
  { number: '102', label: 'Ambulance (Maternity)', desc: 'Maternal & Child Transport', category: 'Medical' },
  { number: '108', label: 'Ambulance (NHM)', desc: 'Medical Emergency Services', category: 'Medical' },
  { number: '101', label: 'Fire Service', desc: 'Fire & Rescue Brigade', category: 'Fire' },
  { number: '1091', label: 'Women Helpline', desc: 'Women Safety & Protection', category: 'Specialized' },
  { number: '1098', label: 'Childline', desc: 'Child Protection Helpline', category: 'Specialized' },
  { number: '14567', label: 'Elderline', desc: 'Senior Citizen Care & Assistance', category: 'Specialized' },
];

export async function GET(request: NextRequest) {
  return apiSuccess({
    country: 'IN',
    countryName: 'India',
    emergencyHotlines: INDIA_EMERGENCY_HOTLINES,
    updatedAt: new Date().toISOString(),
  });
}
