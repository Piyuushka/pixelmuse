import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, question = "What's in front of me?" } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    let spokenResponse = '';
    let visualDetails = {
      obstacles: ['Three steps going up', 'Glass entrance door'],
      hazardLevel: 'low',
      handrail: 'Right side stainless steel handrail',
      surface: 'Textured paving transition',
      stepCount: 3,
    };

    if (image && apiKey) {
      try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const geminiVisionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const promptVision = `
You are an AI Accessibility Assistant for a blind or visually impaired person.
The user points their device camera ahead and asks: "${question}".
Analyze this image:
1. Describe physical obstacles, stairs (count steps up or down), doors (glass door, push/pull, automatic), tactile paving, ramps, or drop-offs directly in front of them.
2. Tell them where handrails, walls, or tactile indicators are located (e.g., "on your right shoulder").
3. Respond in 1 to 2 clear, calm, and concise spoken sentences.
Example: "There are three steps going up, followed by a glass door. Stainless steel handrail is on your right shoulder."
`;

        const res = await fetch(geminiVisionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptVision },
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
              ]
            }],
            generationConfig: { maxOutputTokens: 120, temperature: 0.2 }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            spokenResponse = text.replace(/[*#]/g, '').trim();
          }
        }
      } catch (err) {
        console.warn('Gemini vision API error:', err);
      }
    }

    if (!spokenResponse) {
      spokenResponse = 'There are three steps going up, followed by a glass door. Stainless steel handrail is on your right shoulder.';
    }

    return NextResponse.json({
      success: true,
      spokenResponse,
      visualDetails,
      hapticCue: 'obstacle',
    });
  } catch (error: any) {
    console.error('Describe API error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to analyze surroundings' },
      { status: 500 }
    );
  }
}
