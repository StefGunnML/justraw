import { WebSocket } from 'ws';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import axios from 'axios';
import { query } from './db';
import { ragEngine } from './rag-engine';
import { SCENARIOS, Scenario } from './scenarios';
import { imageService } from './image-service';

interface VoiceWebSocket extends WebSocket {
  chat?: ChatSession;
}

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

async function generateTTS(text: string, character: string): Promise<string> {
  if (!apiKey) return "";
  
  try {
    // Neural2 voices are very high quality
    // Pierre: Neural2-B (Male, Parisian style)
    // Petrov: Neural2-D (Male, deeper)
    const voiceName = character === 'Pierre' ? 'fr-FR-Neural2-B' : 'fr-FR-Neural2-D';
    
    console.log(`[TTS] Generating Google Cloud speech for: ${character} using ${voiceName}`);
    
    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        input: { text },
        voice: { 
          languageCode: 'fr-FR', 
          name: voiceName 
        },
        audioConfig: { 
          audioEncoding: 'MP3',
          pitch: character === 'Pierre' ? -2.0 : -4.0, // Pierre is grumpy, Petrov is deep
          speakingRate: character === 'Pierre' ? 1.05 : 0.85 // Pierre is impatient, Petrov is slow
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    return response.data.audioContent || "";
  } catch (err: any) {
    console.error('[TTS] Google Cloud failed:', err.response?.data || err.message);
    return "";
  }
}

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
        
        console.log(`[VoiceService] Generating initial greeting for: ${currentScenario.id}`);
        const initialGreeting = await chat.sendMessage("Initiate the conversation as your character.");
        const initialText = initialGreeting.response.text();
        
        let parsedInitial;
        try {
          const cleanText = initialText.replace(/```json|```/g, '').trim();
          parsedInitial = JSON.parse(cleanText);
        } catch (e) {
          console.error('[VoiceService] Failed to parse initial greeting:', initialText);
          parsedInitial = { 
            text: currentScenario.id === 'paris-cafe' ? "Bonjour. Qu'est-ce que vous voulez?" : "Vos papiers, s'il vous plaît.", 
            translation: "Hello. What do you want?",
            hints: ["Un café, s'il vous plaît", "Rien pour l'instant", "Vous êtes très impoli"],
            respectDelta: 0 
          };
        }

        // Generate initial background
        const moodDesc = currentRespectScore < 40 ? "unwelcoming and dark" : "bright and cinematic";
        const bgUrl = await imageService.generateBackground(
          `${currentScenario.visualBasePrompt}. Mood: ${moodDesc}`
        );

        // Generate initial speech
        const audioBase64 = await generateTTS(parsedInitial.text, currentScenario.character);

        console.log(`[VoiceService] Ready: ${currentScenario.id}`);
        ws.send(JSON.stringify({ 
          type: 'ready', 
          scenario: currentScenario, 
          respectScore: currentRespectScore,
          initialGreeting: parsedInitial.text,
          translation: parsedInitial.translation,
          hints: parsedInitial.hints,
          imageUrl: bgUrl,
          audio: audioBase64
        }));
        return;
      }
      
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
          parsedResponse = { text: responseText, translation: "", hints: [], respectDelta: 0 };
        }

        const oldScore = currentRespectScore;
        currentRespectScore = Math.max(0, Math.min(100, currentRespectScore + (parsedResponse.respectDelta || 0)));
        await query('UPDATE user_dossier SET respect_score = $1, last_interaction = NOW() WHERE user_id = $2', [currentRespectScore, userId]);
        
        conversationContext += `User: ${userText}\n${currentScenario.character}: ${parsedResponse.text}\n`;

        // Generate audio
        const audioBase64 = await generateTTS(parsedResponse.text, currentScenario.character);

        // Generate new background if respect changed significantly
        let newBgUrl = undefined;
        if (Math.abs(currentRespectScore - oldScore) > 10) {
          const moodDesc = currentRespectScore < 40 ? "very dark and hostile" : currentRespectScore > 70 ? "welcoming and cinematic" : "neutral";
          newBgUrl = await imageService.generateBackground(
            `${currentScenario.visualBasePrompt}. The atmosphere is now ${moodDesc}.`
          );
        }

        ws.send(JSON.stringify({
          type: 'response',
          text: parsedResponse.text,
          translation: parsedResponse.translation,
          hints: parsedResponse.hints,
          character: currentScenario.character,
          respectScore: currentRespectScore,
          imageUrl: newBgUrl,
          audio: audioBase64
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
