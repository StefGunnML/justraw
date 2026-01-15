import { WebSocket } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from './db';
import { ragEngine } from './rag-engine';
import { SCENARIOS, Scenario } from './scenarios';
import { imageService } from './image-service';

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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa'; // Default user
  let conversationContext = "";
  let currentScenario: Scenario = SCENARIOS['paris-cafe'];
  let currentRespectScore = 50;

  try {
    const userRes = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
    currentRespectScore = userRes.rows[0]?.respect_score || 50;
    
    // Initial connection handshake
    ws.on('message', async (data: any) => {
      try {
        if (data.toString().startsWith('{')) {
          const msg = JSON.parse(data.toString());
          
          if (msg.type === 'start') {
            // Allow client to pick a scenario
            if (msg.scenarioId && SCENARIOS[msg.scenarioId]) {
              currentScenario = SCENARIOS[msg.scenarioId];
            }
            
            // Recall past memories for this user
            const memories = await ragEngine.recallMemories(userId, currentScenario.id, 5);
            const memoryContext = memories.map(m => `- ${m.content}`).join('\n');

            const fullSystemPrompt = `${currentScenario.systemPrompt}
              Location: ${currentScenario.location}
              Current Respect Score: ${currentRespectScore}/100
              Memory of previous interactions:
              ${memoryContext || "None."}`;

            // Initialize chat with history
            const chat = model.startChat({
              history: [],
              generationConfig: { responseMimeType: "application/json" }
            });

            // Store chat in the socket object or a closure
            (ws as any).chat = chat;
            (ws as any).systemPrompt = fullSystemPrompt;

            // Generate initial background
            const bgUrl = await imageService.generateBackground(
              `${currentScenario.visualBasePrompt}. Mood: ${currentScenario.initialMood}`,
              currentScenario.referenceImages
            );

            ws.send(JSON.stringify({ 
              type: 'ready', 
              scenario: currentScenario,
              respectScore: currentRespectScore,
              imageUrl: bgUrl
            }));
            return;
          }
        }

        // Handle Audio Binary Data
        const chat = (ws as any).chat;
        const systemPrompt = (ws as any).systemPrompt;
        
        if (!chat) return;

        console.log(`[VoiceService] Processing audio (${data.length} bytes)`);
        
        const audioPart = {
          inlineData: {
            data: data.toString('base64'),
            mimeType: 'audio/pcm;rate=16000'
          }
        };

        // Parallel processing: Gemini (Voice) + FLUX (Visuals)
        const [geminiResult, newBackgroundUrl] = await Promise.all([
          chat.sendMessage([systemPrompt, audioPart as any]),
          // We don't generate a NEW background every single turn to save cost/latency,
          // only if respect score changes significantly or every X turns.
          // For now, let's just do it for major mood shifts.
          null // placeholder
        ]);

        let parsedResponse;
        try {
          // Remove potential markdown backticks from LLM response
          const cleanText = responseText.replace(/```json|```/g, '').trim();
          parsedResponse = JSON.parse(cleanText);
        } catch (e) {
          console.error('[VoiceService] Failed to parse AI response:', responseText);
          parsedResponse = { text: responseText, respectDelta: 0 };
        }

        // Update score
        currentRespectScore = Math.max(0, Math.min(100, currentRespectScore + (parsedResponse.respectDelta || 0)));
        await query('UPDATE user_dossier SET respect_score = $1, last_interaction = NOW() WHERE user_id = $2', [currentRespectScore, userId]);
        
        conversationContext += `User: [Audio]\n${currentScenario.character}: ${parsedResponse.text}\n`;

        // Now generate a dynamic background based on the mood shift
        let reactiveBgUrl = "";
        if (parsedResponse.respectDelta !== 0) {
          const moodDesc = currentRespectScore < 40 ? "angry and dark" : currentRespectScore > 70 ? "welcoming and bright" : "neutral";
          reactiveBgUrl = await imageService.generateBackground(
            `${currentScenario.visualBasePrompt}. The atmosphere is now ${moodDesc}.`,
            currentScenario.referenceImages
          );
        }

        ws.send(JSON.stringify({
          type: 'response',
          text: parsedResponse.text,
          character: currentScenario.character,
          respectScore: currentRespectScore,
          imageUrl: reactiveBgUrl || undefined
        }));

      } catch (err) {
        console.error('[VoiceService] error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Something went wrong.' }));
      }
    });

    ws.on('close', async () => {
      if (conversationContext) {
        await ragEngine.summarizeAndStore(userId, `Scenario: ${currentScenario.name}\n${conversationContext}`);
      }
    });

  } catch (err) {
    console.error('[VoiceService] Init failed:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'Initialization failed' }));
    ws.close();
  }
}
