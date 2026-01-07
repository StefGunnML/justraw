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
    let userState = { respect_score: 50, name: 'L’élève', loyalty_level: 1 };
    
    try {
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      } else {
        await query('INSERT INTO user_dossier (user_id, respect_score) VALUES ($1, $2)', [userId, 50]);
      }
    } catch (dbErr) {
      console.error('Database error:', dbErr);
    }

    // 2. Determine Context (Time of Day & Cultural Rules)
    const now = new Date();
    const hour = now.getHours();
    let timeContext = "standard";
    if (hour < 11) timeContext = "morning (croissants should be fresh, but don't ask for them too late)";
    else if (hour >= 11 && hour < 14) timeContext = "lunch rush (Pierre is very busy and impatient)";
    else if (hour >= 14 && hour < 18) timeContext = "afternoon (no milk in coffee, that's for breakfast)";
    else timeContext = "evening (Pierre is tired and wants to go home)";

    // 3. Call GPU Inference Gateway (Scaleway/DataCrunch)
    const gpuGatewayUrl = process.env.GPU_GATEWAY_URL;
    let result;

    if (!gpuGatewayUrl || gpuGatewayUrl.includes('YOUR_GPU_IP')) {
      console.log('Running in MOCK mode...');
      result = {
        transcription: "Un café au lait, s'il vous plaît.",
        aiResponse: hour > 11 ? "Pfff... Un café au lait ? À cette heure-ci ? C'est le matin pour ça. Enfin bref." : "Oui, oui... voilà votre café.",
        audioBase64: "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==",
        respectChange: hour > 11 ? -5 : 2
      };
    } else {
      const gpuFormData = new FormData();
      gpuFormData.append('file', audioFile);
      gpuFormData.append('respect_score', userState.respect_score.toString());
      gpuFormData.append('time_context', timeContext);
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

    // 4. Update User State (Respect Score & Loyalty)
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
