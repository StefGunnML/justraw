import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      console.error('No audio file in request');
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // 1. Fetch User State (Dossier)
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; 
    let userState = { respect_score: 50, name: 'L’élève', session_count: 1 };
    
    try {
      console.log('Connecting to DB...');
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      } else {
        await query('INSERT INTO user_dossier (user_id, respect_score, session_count) VALUES ($1, $2, $3)', [userId, 50, 1]);
      }
    } catch (dbErr) {
      console.error('DB ERROR:', dbErr.message);
      // Fallback user state so we don't crash the whole app if DB is briefly down
      userState = { respect_score: 50, name: 'L’élève', session_count: 1 };
    }

    // 2. Determine Context (Time of Day in Paris)
    const parisTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false
    }).format(new Date());
    const hour = parseInt(parisTime);

    const systemPrompt = `
      You are Pierre, a busy, arrogant Parisian waiter at a high-end café.
      TIME: ${hour}:00 in Paris.
      USER: ${userState.name}, Respect: ${userState.respect_score}/100.
      RULES: Be rude, short, and use French fillers (Pff, Bof). 
      If they order milk coffee after 3pm, mock them.
    `;

    // 3. Call GPU Inference Gateway
    const gpuGatewayUrl = process.env.GPU_GATEWAY_URL;
    let result;

    const MOCK_AUDIO = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

    if (!gpuGatewayUrl || gpuGatewayUrl.includes('YOUR_GPU_IP')) {
      result = {
        transcription: "Un café, s'il vous plaît.",
        aiResponse: "Oui, oui... ça arrive.",
        audioBase64: MOCK_AUDIO,
        respectChange: 1
      };
    } else {
      try {
        const gpuFormData = new FormData();
        gpuFormData.append('file', audioFile);
        gpuFormData.append('system_prompt', systemPrompt);
        gpuFormData.append('respect_score', userState.respect_score.toString());

        const gpuResponse = await fetch(`${gpuGatewayUrl}/process`, {
          method: 'POST',
          headers: { 'X-API-KEY': process.env.GPU_API_KEY || '' },
          body: gpuFormData,
          signal: AbortSignal.timeout(15000) // 15s timeout
        });

        if (!gpuResponse.ok) throw new Error(`GPU Bridge status: ${gpuResponse.status}`);
        result = await gpuResponse.json();
      } catch (gpuErr) {
        console.error('GPU Bridge Error:', gpuErr.message);
        result = {
          transcription: "[Inaudible]",
          aiResponse: "Hein ? Quoi ? Je n'ai pas compris votre charabia.",
          audioBase64: MOCK_AUDIO,
          respectChange: -1
        };
      }
    }

    // 4. Update DB (Background - don't wait for it to return to user)
    query(
      'UPDATE user_dossier SET respect_score = $1, last_interaction = NOW(), session_count = session_count + 1 WHERE user_id = $2',
      [Math.max(0, Math.min(100, (userState.respect_score || 50) + (result.respectChange || 0))), userId]
    ).catch(e => console.error('Delayed DB Update failed:', e.message));

    return NextResponse.json({
      userText: result.transcription,
      aiText: result.aiResponse,
      audio: result.audioBase64,
      respectScore: userState.respect_score + (result.respectChange || 0)
    });

  } catch (error) {
    console.error('ROUTE FATAL:', error);
    return NextResponse.json({ 
      error: 'Pierre is busy', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
