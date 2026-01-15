import { WebSocket } from 'ws';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import { query } from './db';
import { ragEngine } from './rag-engine';
import { SCENARIOS, Scenario } from './scenarios';

// Extend WebSocket to include our session-specific data
interface VoiceWebSocket extends WebSocket {
  chat?: ChatSession;
}

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Convert PCM Int16 to WAV format (Gemini needs proper audio formats)
function pcmToWav(pcmData: Buffer, sampleRate: number = 16000, channels: number = 1, bitsPerSample: number = 16): Buffer {
  const dataLength = pcmData.length;
  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
  header.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  
  return Buffer.concat([header, pcmData]);
}

export async function handleVoiceWebSocket(ws: VoiceWebSocket) {
  if (!genAI) {
    console.error('[VoiceService] No Gemini API key configured');
    ws.send(JSON.stringify({ type: 'error', message: 'API key missing' }));
    ws.close();
    return;
  }
  
  console.log('[VoiceService] Initializing Gemini...');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Using stable model
  
  const userId = '69556352-840f-45ff-9a8a-6b2a2ce074fa';
  let conversationContext = "";
  let currentScenario: Scenario = SCENARIOS['paris-cafe'];
  let currentRespectScore = 50;

  let isProcessing = false;
  const handleMessage = async (data: Buffer | string) => {
    if (isProcessing) {
      console.log('[VoiceService] Busy, skipping...');
      return;
    }
    isProcessing = true;

    try {
      const dataString = data.toString();
      if (dataString.startsWith('{')) {
        const msg = JSON.parse(dataString);
        console.log(`[VoiceService] Control: ${msg.type}`);
        
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
      }

      const chat = ws.chat;
      if (!chat) {
        console.warn('[VoiceService] No chat session');
        isProcessing = false;
        return;
      }

      // Process audio data
      const audioBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      console.log(`[VoiceService] Audio: ${audioBuffer.length} bytes`);
      
      // Convert raw PCM to WAV format
      const wavBuffer = pcmToWav(audioBuffer, 16000, 1, 16);
      const wavBase64 = wavBuffer.toString('base64');

      const audioPart = {
        inlineData: {
          data: wavBase64,
          mimeType: 'audio/wav'
        }
      };

      console.log('[VoiceService] Sending WAV to Gemini...');
      const geminiResult = await chat.sendMessage([audioPart]);
      const responseText = geminiResult.response.text();
      console.log('[VoiceService] Gemini response received');

      let parsedResponse;
      try {
        const cleanText = responseText.replace(/```json|```/g, '').trim();
        parsedResponse = JSON.parse(cleanText);
      } catch (e) {
        parsedResponse = { text: responseText, respectDelta: 0 };
      }

      currentRespectScore = Math.max(0, Math.min(100, currentRespectScore + (parsedResponse.respectDelta || 0)));
      await query('UPDATE user_dossier SET respect_score = $1, last_interaction = NOW() WHERE user_id = $2', [currentRespectScore, userId]);
      
      conversationContext += `User: [Audio]\n${currentScenario.character}: ${parsedResponse.text}\n`;

      ws.send(JSON.stringify({
        type: 'response',
        text: parsedResponse.text,
        character: currentScenario.character,
        respectScore: currentRespectScore
      }));

    } catch (err: any) {
      console.error('[VoiceService] Error:', err.message || err);
      ws.send(JSON.stringify({ type: 'error', message: 'Processing failed. Try again.' }));
    } finally {
      isProcessing = false;
    }
  };

  ws.on('message', handleMessage);

  try {
    const userRes = await query('SELECT * FROM user_dossier WHERE user_id = $1', [userId]);
    currentRespectScore = userRes.rows[0]?.respect_score || 50;
    console.log(`[VoiceService] User loaded. Score: ${currentRespectScore}`);
    
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
