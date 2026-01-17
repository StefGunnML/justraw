import { WebSocket } from 'ws';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import { query } from './db';
import { ragEngine } from './rag-engine';
import { SCENARIOS, Scenario } from './scenarios';

interface VoiceWebSocket extends WebSocket {
  chat?: ChatSession;
}

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function handleVoiceWebSocket(ws: VoiceWebSocket) {
  if (!genAI) {
    console.error('[VoiceService] No Gemini API key');
    ws.send(JSON.stringify({ type: 'error', message: 'API key missing' }));
    ws.close();
    return;
  }
  
  console.log('[VoiceService] Initializing with gemini-2.0-flash...');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa';
  let conversationContext = "";
  let currentScenario: Scenario = SCENARIOS['paris-cafe'];
  let currentRespectScore = 50;

  let isProcessing = false;
  const handleMessage = async (data: Buffer | string) => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const dataString = data.toString();
      const msg = JSON.parse(dataString);
      console.log(`[VoiceService] Message: ${msg.type}`);
      
      if (msg.type === 'start') {
        if (msg.scenarioId && SCENARIOS[msg.scenarioId]) {
          currentScenario = SCENARIOS[msg.scenarioId];
        }
        
        const memories = await ragEngine.recallMemories(userId, currentScenario.id, 5);
        const memoryContext = memories.map((m: any) => `- ${m.content}`).join('\n');

        const systemPrompt = `${currentScenario.systemPrompt}
          Location: ${currentScenario.location}
          Current Respect Score: ${currentRespectScore}/100
          Memory: ${memoryContext || "None."}`;

        const chat = model.startChat({
          history: [],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.7,
          }
        });

        ws.chat = chat;
        
        console.log(`[VoiceService] Ready: ${currentScenario.id}`);
        ws.send(JSON.stringify({ 
          type: 'ready', 
          scenario: currentScenario, 
          respectScore: currentRespectScore 
        }));
        return;
      }
      
      // Handle transcribed text from client
      if (msg.type === 'text') {
        const chat = ws.chat;
        if (!chat) {
          console.warn('[VoiceService] No chat session');
          isProcessing = false;
          return;
        }

        const userText = msg.text;
        console.log(`[VoiceService] User said: "${userText}"`);
        console.log('[VoiceService] Sending to Gemini...');
        
        const geminiResult = await chat.sendMessage(userText);
        const responseText = geminiResult.response.text();
        console.log('[VoiceService] Gemini response:', responseText.substring(0, 100));

        let parsedResponse;
        try {
          const cleanText = responseText.replace(/```json|```/g, '').trim();
          parsedResponse = JSON.parse(cleanText);
        } catch (e) {
          parsedResponse = { text: responseText, respectDelta: 0 };
        }

        currentRespectScore = Math.max(0, Math.min(100, currentRespectScore + (parsedResponse.respectDelta || 0)));
        await query('UPDATE user_dossier SET respect_score = $1, last_interaction = NOW() WHERE user_id = $2', [currentRespectScore, userId]);
        
        conversationContext += `User: ${userText}\n${currentScenario.character}: ${parsedResponse.text}\n`;

        ws.send(JSON.stringify({
          type: 'response',
          text: parsedResponse.text,
          character: currentScenario.character,
          respectScore: currentRespectScore
        }));
      }

    } catch (err: any) {
      const errorMsg = err.message || String(err);
      console.error('[VoiceService] Error:', errorMsg);
      ws.send(JSON.stringify({ type: 'error', message: errorMsg.substring(0, 200) }));
    } finally {
      isProcessing = false;
    }
  };

  ws.on('message', handleMessage);

  try {
    const userRes = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
    currentRespectScore = userRes.rows[0]?.respect_score || 50;
    console.log(`[VoiceService] User score: ${currentRespectScore}`);
    
    ws.on('close', async () => {
      if (conversationContext) {
        await ragEngine.summarizeAndStore(userId, `Scenario: ${currentScenario.name}\n${conversationContext}`);
      }
    });

  } catch (err) {
    console.error('[VoiceService] Init failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'Init failed' }));
    ws.close();
  }
}
