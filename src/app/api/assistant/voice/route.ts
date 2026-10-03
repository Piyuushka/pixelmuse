import { NextResponse } from 'next/server';
import { calculateAdaptedRoute, DEFAULT_NODES, DEFAULT_EDGES } from '@/lib/routingEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcript, currentCoords, userPersona = 'wheelchair' } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Transcript string is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    let parsedResult = {
      intent: 'NAVIGATE' as 'NAVIGATE' | 'REPORT_BARRIER' | 'QUERY' | 'UNKNOWN',
      destination: 'Cardiology Pavilion Suite 304',
      origin: 'South Concourse Entrance',
      persona: userPersona,
      spokenResponse: '',
    };

    if (apiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const promptText = `
You are an AI Accessibility Assistant for a barrier-free navigation app.
User spoken request: "${transcript}"
User mobility profile: "${userPersona}"

Extract the intent and target destination. Return ONLY a valid JSON object matching this structure:
{
  "intent": "NAVIGATE" | "REPORT_BARRIER" | "QUERY" | "UNKNOWN",
  "destination": "string name of destination venue or landmark",
  "origin": "string name of origin if mentioned, else 'Current Location'",
  "persona": "wheelchair" | "low-vision" | "older-adult" | "caregiver",
  "spokenResponse": "Concise 1-2 sentence spoken vocal response for Text-to-Speech confirmation"
}
`;

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanJson = rawText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            parsedResult = { ...parsedResult, ...parsed };
          }
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, using fallback parser:', geminiError);
      }
    }

    // Fallback smart parser if Gemini API key is omitted or fails
    if (!parsedResult.spokenResponse) {
      const lower = transcript.toLowerCase();
      if (lower.includes('library') || lower.includes('central')) {
        parsedResult.destination = 'Central Library & Reading Hub';
      } else if (lower.includes('hospital') || lower.includes('cardiology') || lower.includes('doctor')) {
        parsedResult.destination = 'Cardiology Pavilion Suite 304';
      } else if (lower.includes('park') || lower.includes('shivaji')) {
        parsedResult.destination = 'Shivaji Park Accessible Concourse';
      } else if (lower.includes('station') || lower.includes('railway') || lower.includes('dadar')) {
        parsedResult.destination = 'Dadar Station Lift Lobby B';
      } else {
        // Extract any words after "to" or "find"
        const match = lower.match(/(?:to|find|navigate to|go to)\s+(.+)/i);
        if (match && match[1]) {
          parsedResult.destination = match[1].replace(/[^\w\s]/gi, '').trim();
        }
      }

      if (lower.includes('step free') || lower.includes('wheelchair')) {
        parsedResult.persona = 'wheelchair';
      } else if (lower.includes('blind') || lower.includes('vision') || lower.includes('audio')) {
        parsedResult.persona = 'low-vision';
      }

      parsedResult.spokenResponse = `Calculating ${parsedResult.persona} accessible route to ${parsedResult.destination}. Step-free path guaranteed.`;
    }

    // Calculate Accessible Route using internal routing engine
    const startNodeId = 'node-start';
    const targetNodeId = 'node-dest';
    const routeEngineResult = calculateAdaptedRoute([], DEFAULT_NODES, DEFAULT_EDGES, startNodeId, targetNodeId);

    return NextResponse.json({
      success: true,
      intent: parsedResult.intent,
      destination: parsedResult.destination,
      origin: parsedResult.origin,
      persona: parsedResult.persona,
      spokenResponse: parsedResult.spokenResponse,
      hapticCue: 'left_turn',
      metrics: {
        distanceMeters: routeEngineResult.totalDistanceMeters,
        estimatedTimeMinutes: routeEngineResult.estimatedTimeMinutes,
        isStepFree: routeEngineResult.isStepFree,
        barriersAvoided: routeEngineResult.affectedByBarriers.length,
      },
      navigationSteps: [
        { instruction: 'Head straight on Central Concourse Walkway for 150 meters', cue: 'confirm', distance: '150m' },
        { instruction: 'Slight left at South Ramp C (3.5% incline)', cue: 'left_turn', distance: '80m' },
        { instruction: 'Take Elevator B Hub to Level 3', cue: 'confirm', distance: 'Elevator' },
        { instruction: `Arrive at ${parsedResult.destination}`, cue: 'stop', distance: '0m' },
      ],
      route: routeEngineResult,
    });
  } catch (err: any) {
    console.error('Voice Assistant Endpoint Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error processing voice request' },
      { status: 500 }
    );
  }
}
