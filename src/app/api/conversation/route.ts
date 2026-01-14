import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/7bf95331-fd0d-4a43-88da-dd7d07d79f6f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:4',message:'POST request received',data:{hasAudioFile:!!audioFile,hasSessionId:!!sessionId,audioFileSize:audioFile?.size,audioFileType:audioFile?.type},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'No session ID provided' }, { status: 400 });
    }

    // 1. Fetch User State
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; 
    let userState = { respect_score: 50, name: "L'eleve", session_count: 1 };
    
    try {
      const res = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
      if (res.rows.length > 0) {
        userState = res.rows[0];
      }
    } catch (dbErr) {
      console.error('DB Handshake Error');
    }

    // 2. Gemini AI Processing
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let result;

    // Audible "Beep" for diagnostic
    const TEST_BEEP = "data:audio/wav;base64,UklGRl9vT1RKdmVyc2lvbgEAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAABvT1RK";

    try {
      const systemPrompt = `You are Pierre, a French café waiter in Paris, 18ème arrondissement. You are DIRECT and speak ONLY in dialogue, never in stage directions or narrative.

Current mood: ${userState.respect_score > 60 ? 'Polite but efficient' : 'Impatient and curt'}
Rules:
- Speak ONLY what Pierre says out loud
- NO stage directions like *taps notepad* or *sighs*
- NO narrative descriptions
- Use casual French (tu vs vous based on respect)
- Be brief and realistic
- ${userState.respect_score > 80 ? 'You call the customer Madame/Monsieur' : 'You are informal'}

Example GOOD response: "Un café. C'est noté. Autre chose ?"
Example BAD response: "*Tapotant le carnet de commandes* Un café. *Soupir* Autre chose ?"`;

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Convert audio to base64
      const audioBytes = await audioFile.arrayBuffer();
      const audioBase64 = Buffer.from(audioBytes).toString('base64');

      // Call Gemini with audio
      const geminiResult = await model.generateContent([
        {
          inlineData: {
            mimeType: audioFile.type || 'audio/webm',
            data: audioBase64
          }
        },
        systemPrompt
      ]);

      const response = await geminiResult.response;
      const aiText = response.text();

      // Calculate respect change based on audio
      let respectChange = 0;
      const lowerText = aiText.toLowerCase();
      if (lowerText.includes("s'il vous plaît") || lowerText.includes("merci")) {
        respectChange += 2;
      }
      if (lowerText.includes("bordel") || lowerText.includes("merde")) {
        respectChange -= 3;
      }

      result = {
        transcription: "[Audio transcrit par Gemini]",
        aiResponse: aiText,
        audioBase64: "", // TTS will be added in next phase
        respectChange: respectChange
      };
    } catch (err) {
      console.error('Gemini error:', err);
      result = {
        transcription: "[Espace de silence]",
        aiResponse: "Pff... je n'entends rien. Votre micro est en panne ou quoi ?",
        audioBase64: TEST_BEEP,
        respectChange: -1
      };
    }

    const newRespectScore = Math.max(0, Math.min(100, (userState.respect_score || 50) + (result.respectChange || 0)));

    // 3. Update DB - User State
    await query(
      'UPDATE user_dossier SET respect_score = $1, session_count = session_count + 1 WHERE user_id = $2',
      [newRespectScore, userId]
    ).catch(() => {});

    // 4. Save Conversation to Database
    try {
      await query(
        `INSERT INTO conversations 
         (user_id, session_id, user_message, ai_response, respect_change, respect_score_after) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          sessionId,
          result.transcription || '',
          result.aiResponse || '',
          result.respectChange || 0,
          newRespectScore
        ]
      );
    } catch (dbErr) {
      console.error('Failed to save conversation:', dbErr);
    }

    return NextResponse.json({
      userText: result.transcription,
      aiText: result.aiResponse,
      audio: result.audioBase64,
      respectScore: newRespectScore
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Pierre is ignoring you' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa';

    if (sessionId) {
      // Get messages for specific session
      const result = await query(
        'SELECT * FROM conversations WHERE user_id = $1 AND session_id = $2 ORDER BY created_at ASC',
        [userId, sessionId]
      );
      return NextResponse.json({ conversations: result.rows });
    } else {
      // Get all sessions with their last message
      const result = await query(
        `SELECT DISTINCT ON (session_id) 
         session_id, 
         user_message, 
         ai_response, 
         respect_score_after,
         created_at,
         (SELECT COUNT(*) FROM conversations c2 WHERE c2.session_id = conversations.session_id) as message_count
         FROM conversations 
         WHERE user_id = $1 
         ORDER BY session_id, created_at DESC`,
        [userId]
      );
      return NextResponse.json({ sessions: result.rows });
    }
  } catch (error: any) {
    console.error('Failed to fetch conversations:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    return NextResponse.json({ 
      error: 'Failed to fetch conversations',
      details: error.message,
      code: error.code
    }, { status: 500 });
  }
}
