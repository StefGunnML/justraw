import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'No session ID provided' }, { status: 400 });
    }

    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; 
    let userState = { respect_score: 50, name: "L'eleve", session_count: 1 };
    
    try {
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      }
    } catch (dbErr) {
      console.error('DB Error:', dbErr);
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    let transcription = '';
    let aiResponse = '';
    let respectChange = 0;

    if (!geminiApiKey) {
      aiResponse = "Désolé, le service n'est pas configuré.";
    } else {
      try {
        const systemPrompt = `You are Pierre, a French café waiter in Paris. Respond ONLY with dialogue, no stage directions.
Mood: ${userState.respect_score > 60 ? 'Polite' : 'Impatient'}
Rules: Speak French, be brief, ${userState.respect_score > 80 ? 'use vous' : 'use tu'}`;

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const audioBytes = await audioFile.arrayBuffer();
        const audioBase64 = Buffer.from(audioBytes).toString('base64');

        const result = await model.generateContent([
          { inlineData: { mimeType: audioFile.type || 'audio/webm', data: audioBase64 } },
          `Listen to this audio and respond as Pierre the waiter. ${systemPrompt}`
        ]);

        aiResponse = result.response.text();
        transcription = '[Audio reçu]';
        
        if (aiResponse.toLowerCase().includes('merci')) respectChange = 1;
        if (aiResponse.toLowerCase().includes('non')) respectChange = -1;
      } catch (err) {
        console.error('Gemini error:', err);
        aiResponse = "Pff... je n'entends rien.";
        respectChange = -1;
      }
    }

    const newRespectScore = Math.max(0, Math.min(100, (userState.respect_score || 50) + respectChange));

    await query(
      'UPDATE user_dossier SET respect_score = $1, session_count = session_count + 1 WHERE user_id = $2',
      [newRespectScore, userId]
    ).catch(() => {});

    try {
      await query(
        `INSERT INTO conversations (user_id, session_id, user_message, ai_response, respect_change, respect_score_after) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, sessionId, transcription, aiResponse, respectChange, newRespectScore]
      );
    } catch (dbErr) {
      console.error('Failed to save conversation');
    }

    return NextResponse.json({
      userText: transcription,
      aiText: aiResponse,
      audio: '',
      respectScore: newRespectScore
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Pierre is ignoring you' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa';

    if (sessionId) {
      const result = await query(
        'SELECT * FROM conversations WHERE user_id = $1 AND session_id = $2 ORDER BY created_at ASC',
        [userId, sessionId]
      );
      return NextResponse.json({ conversations: result.rows });
    } else {
      const result = await query(
        `SELECT DISTINCT ON (session_id) session_id, user_message, ai_response, respect_score_after, created_at,
         (SELECT COUNT(*) FROM conversations c2 WHERE c2.session_id = conversations.session_id) as message_count
         FROM conversations WHERE user_id = $1 ORDER BY session_id, created_at DESC`,
        [userId]
      );
      return NextResponse.json({ sessions: result.rows });
    }
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
