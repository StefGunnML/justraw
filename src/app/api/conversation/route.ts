import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // 1. Fetch User State
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; 
    let userState = { respect_score: 50, name: 'L’élève', session_count: 1 };
    
    try {
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      }
    } catch (dbErr) {
      console.error('DB Handshake Error');
    }

    // 2. GPU Handshake
    const gpuGatewayUrl = process.env.GPU_GATEWAY_URL;
    let result;

    // Audible "Beep" for diagnostic
    const TEST_BEEP = "data:audio/wav;base64,UklGRl9vT1RKdmVyc2lvbgEAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAABvT1RK";

    try {
      const gpuFormData = new FormData();
      gpuFormData.append('file', audioFile);
      gpuFormData.append('respect_score', userState.respect_score.toString());

      const gpuResponse = await fetch(`${gpuGatewayUrl}/process`, {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.GPU_API_KEY || '' },
        body: gpuFormData,
        signal: AbortSignal.timeout(10000) 
      });

      if (!gpuResponse.ok) throw new Error("GPU_DOWN");
      result = await gpuResponse.json();
    } catch (err) {
      result = {
        transcription: "[Espace de silence]",
        aiResponse: "Pff... je n'entends rien. Votre micro est en panne ou quoi ?",
        audioBase64: TEST_BEEP,
        respectChange: -1
      };
    }

    // 3. Update DB
    query(
      'UPDATE user_dossier SET respect_score = $1, session_count = session_count + 1 WHERE user_id = $2',
      [Math.max(0, Math.min(100, (userState.respect_score || 50) + (result.respectChange || 0))), userId]
    ).catch(() => {});

    return NextResponse.json({
      userText: result.transcription,
      aiText: result.aiResponse,
      audio: result.audioBase64,
      respectScore: (userState.respect_score || 50) + (result.respectChange || 0)
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Pierre is ignoring you' }, { status: 500 });
  }
}
