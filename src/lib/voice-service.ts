import { WebSocket } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from './db';
import { ragEngine } from './rag-engine';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function handleVoiceWebSocket(ws: WebSocket) {
  if (!genAI) {
    console.error('[VoiceService] No Gemini API key configured');
    ws.send(JSON.stringify({ type: 'error', message: 'API key missing' }));
    ws.close();
    return;
  }
  
  console.log('[VoiceService] Initializing Gemini Multimodal Live...');

  // Use the latest experimental model for multimodal live
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; // Default user for this session
  let conversationContext = "";

  try {
    // 1. Fetch user state & memories
    const userRes = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
    const userState = userRes.rows[0] || { respect_score: 50, name: "L'élève" };
    
    // Recall past relevant memories
    const memories = await ragEngine.recallMemories(userId, "general context", 5);
    const memoryContext = memories.map(m => `- ${m.content}`).join('\n');

    const systemPrompt = `You are Pierre, a French café waiter in Paris. 
Current mood: ${userState.respect_score > 60 ? 'Polite but efficient' : 'Impatient and curt'}
Respect Score: ${userState.respect_score}/100

Past memories of this client:
${memoryContext || "No previous interactions remembered."}

Rules:
- Speak ONLY dialogue. No stage directions like *sighs* or *wipes table*.
- Use casual French (tu/vous).
- Be extremely brief and direct.
- Your respect score for the user changes based on their politeness.
- If they are rude, decrease respect. If they use "S'il vous plaît", increase it slightly.
- Respond with a JSON object: {"text": "your response", "respectDelta": number}`;

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: "Bonjour Pierre." }] },
        { role: 'model', parts: [{ text: JSON.stringify({ text: "Bonjour. Qu'est-ce que vous voulez?", respectDelta: 0 }) }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    ws.on('message', async (data: any) => {
      try {
        // Handle control messages
        if (data.toString().startsWith('{')) {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'start') {
            ws.send(JSON.stringify({ type: 'ready' }));
          }
          return;
        }

        // Handle Audio Binary Data
        // In a real implementation, we would stream this to Google's WebSocket.
        // For this version, we'll convert the buffer to a part and send to the model.
        console.log(`[VoiceService] Processing audio chunk (${data.length} bytes)`);
        
        // Convert binary to base64 for the API
        const audioPart = {
          inlineData: {
            data: data.toString('base64'),
            mimeType: 'audio/pcm;rate=16000' // Assumption for VAD-web output
          }
        };

        const result = await chat.sendMessage([systemPrompt, audioPart as any]);
        const responseText = result.response.text();
        const parsedResponse = JSON.parse(responseText);

        // Update respect score in DB
        const newScore = Math.max(0, Math.min(100, userState.respect_score + (parsedResponse.respectDelta || 0)));
        await query('UPDATE user_dossier SET respect_score = $1, last_interaction = NOW() WHERE user_id = $2', [newScore, userId]);
        
        // Append to local history for summarization later
        conversationContext += `User: [Audio Input]\nPierre: ${parsedResponse.text}\n`;

        // Send response back to client
        ws.send(JSON.stringify({
          type: 'response',
          text: parsedResponse.text,
          respectScore: newScore
        }));

      } catch (err) {
        console.error('[VoiceService] Message error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Pierre had trouble hearing that.' }));
      }
    });

    ws.on('close', async () => {
      console.log('[VoiceService] Client disconnected. Saving session summary...');
      if (conversationContext) {
        await ragEngine.summarizeAndStore(userId, conversationContext);
      }
    });

  } catch (err) {
    console.error('[VoiceService] Initialization failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'Initialization failed' }));
    ws.close();
  }
}
