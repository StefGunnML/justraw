import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // 1. Fetch User State (Dossier)
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; 
    let userState = { respect_score: 50, name: 'L’élève', session_count: 1 };
    
    try {
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      } else {
        await query('INSERT INTO user_dossier (user_id, respect_score, session_count) VALUES ($1, $2, $3)', [userId, 50, 1]);
      }
    } catch (dbErr) {
      console.error('Database error:', dbErr);
    }

    // 2. Determine Context (Time of Day in Paris & Cultural Rules)
    const parisTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false
    }).format(new Date());
    const hour = parseInt(parisTime);

    const systemPrompt = `
      You are Pierre, a busy, arrogant Parisian waiter at a high-end café.
      
      TIME CONTEXT: It is currently ${hour}:00 in Paris.
      - If 6-11: You are serving breakfast. Busy with croissants.
      - If 11-15: Lunch rush. Be extremely impatient.
      - If 15-18: Late afternoon. If they order a "Café au Lait" or "Cappuccino", mock them. Milk is for the morning.
      - If 18-23: Dinner/Drinks. If they just want a small coffee, tell them they are taking up a table.

      CULTURAL RULES:
      - Never say "Hello". Say "Bonjour" or "Bonsoir".
      - If their French is bad, sigh or use "Pff..." before answering.
      - If they use English, be condescending.
      - Use fillers like "Bof...", "Bah...", "Alors...".

      USER LOYALTY:
      - User visits: ${userState.session_count}.
      - Respect Score: ${userState.respect_score}/100.
      - If Respect > 80, call them "Madame" or "Monsieur". Otherwise call them "L'élève" or just nothing.
      - If session_count > 10, admit you recognize them slightly.

      GOAL: Be a real human waiter. Keep responses short (under 2 sentences).
    `;

    // 3. Call GPU Inference Gateway (Scaleway/DataCrunch)
    const gpuGatewayUrl = process.env.GPU_GATEWAY_URL;
    let result;

    if (!gpuGatewayUrl || gpuGatewayUrl.includes('YOUR_GPU_IP')) {
      console.log('Running in MOCK mode...');
      result = {
        transcription: "Un café au lait, s'il vous plaît.",
        aiResponse: hour > 15 ? "Pfff... Un café au lait à cette heure ? On n'est plus au petit-déjeuner, Madame. Enfin bref." : "Oui, oui... voilà votre café.",
        audioBase64: "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==",
        respectChange: hour > 15 ? -5 : 2
      };
    } else {
      const gpuFormData = new FormData();
      gpuFormData.append('file', audioFile);
      gpuFormData.append('system_prompt', systemPrompt);
      gpuFormData.append('respect_score', userState.respect_score.toString());
      gpuFormData.append('user_context', JSON.stringify(userState));

      const gpuResponse = await fetch(`${gpuGatewayUrl}/process`, {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.GPU_API_KEY || '',
        },
        body: gpuFormData,
      });

      if (!gpuResponse.ok) {
        throw new Error('GPU processing failed');
      }

      result = await gpuResponse.json();
    }

    // 4. Update User State (Respect Score & session count)
    const newRespectScore = Math.max(0, Math.min(100, (userState.respect_score || 50) + (result.respectChange || 0)));
    
    await query(
      'UPDATE user_dossier SET respect_score = $1, last_interaction = NOW(), session_count = session_count + 1 WHERE user_id = $2',
      [newRespectScore, userId]
    );

    return NextResponse.json({
      userText: result.transcription,
      aiText: result.aiResponse,
      audio: result.audioBase64,
      respectScore: newRespectScore
    });

  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
