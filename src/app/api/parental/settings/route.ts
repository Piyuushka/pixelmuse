import { NextResponse } from 'next/server';
import {
  addEmergencyContact,
  deleteEmergencyContact,
  updatePrivacyConsent,
} from '@/lib/db/userStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, contact, contactId, consent } = body;

    if (!email) {
      return NextResponse.json({ error: 'User email is required.' }, { status: 400 });
    }

    if (action === 'add_emergency_contact') {
      if (!contact || !contact.name || !contact.phone) {
        return NextResponse.json({ error: 'Contact name and phone are required.' }, { status: 400 });
      }
      const contacts = addEmergencyContact(email, contact);
      return NextResponse.json({
        message: 'Emergency contact added successfully to database.',
        emergencyContacts: contacts,
      });
    }

    if (action === 'delete_emergency_contact') {
      if (!contactId) {
        return NextResponse.json({ error: 'contactId is required.' }, { status: 400 });
      }
      const contacts = deleteEmergencyContact(email, contactId);
      return NextResponse.json({
        message: 'Emergency contact deleted.',
        emergencyContacts: contacts,
      });
    }

    if (action === 'update_privacy') {
      if (!consent) {
        return NextResponse.json({ error: 'Privacy consent object required.' }, { status: 400 });
      }
      const updatedConsent = updatePrivacyConsent(email, consent);
      return NextResponse.json({
        message: 'Privacy consent settings updated in database.',
        privacyConsent: updatedConsent,
      });
    }

    return NextResponse.json({ error: 'Invalid settings action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Parental settings update failed' },
      { status: 500 }
    );
  }
}
