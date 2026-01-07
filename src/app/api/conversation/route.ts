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
    // For now, using a hardcoded user_id for testing
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; 
    let userState = { respect_score: 50, name: 'L’élève' };
    
    try {
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      } else {
        // Initial insert
        await query('INSERT INTO user_dossier (user_id, respect_score) VALUES ($1, $2)', [userId, 50]);
      }
    } catch (dbErr) {
      console.error('Database error, proceeding with defaults:', dbErr);
    }

    // 2. Call GPU Inference Gateway (Scaleway/DataCrunch)
    const gpuGatewayUrl = process.env.GPU_GATEWAY_URL;
    let result;

    if (!gpuGatewayUrl || gpuGatewayUrl.includes('YOUR_GPU_IP')) {
      // MOCK MODE for initial testing
      console.log('Running in MOCK mode...');
      result = {
        transcription: "Pardon, je... je cherche le café ?",
        aiResponse: "Quoi ? Vous êtes perdu ? Le café est juste devant vous. Ouvrez les yeux !",
        audioBase64: "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==",
        respectChange: -2
      };
    } else {
      const gpuFormData = new FormData();
      gpuFormData.append('file', audioFile);
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
        const errorText = await gpuResponse.text();
        console.error('GPU Gateway error:', errorText);
        throw new Error('GPU processing failed');
      }

      result = await gpuResponse.json();
    }

    // 3. Update User State (Respect Score Logic)
    // The GPU service can suggest a score change based on the AI's "mood"
    const newRespectScore = Math.max(0, Math.min(100, userState.respect_score + (result.respectChange || 0)));
    
    await query(
      'UPDATE user_dossier SET respect_score = $1, last_interaction = NOW() WHERE user_id = $2',
      [newRespectScore, userId]
    );

    return NextResponse.json({
      userText: result.transcription,
      aiText: result.aiResponse,
      audio: result.audioBase64, // Expected as data:audio/wav;base64,...
      respectScore: newRespectScore
    });

  } catch (error) {
    console.error('Route error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
