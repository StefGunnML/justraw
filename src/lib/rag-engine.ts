import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from './db';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export class RAGEngine {
  private model = genAI ? genAI.getGenerativeModel({ model: 'text-embedding-004' }) : null;

  async addMemory(userId: string, content: string, metadata: any = {}) {
    if (!this.model) {
      console.warn('[RAG] No Gemini API key, skipping memory addition');
      return;
    }
    try {
      console.log(`[RAG] Generating embedding for memory: "${content.substring(0, 50)}..."`);
      
      const result = await this.model.embedContent(content);
      const embedding = result.embedding.values;

      await query(
        'INSERT INTO knowledge_base (user_id, content, embedding, metadata) VALUES ($1, $2, $3, $4)',
        [userId, content, JSON.stringify(embedding), JSON.stringify(metadata)]
      );
      
      console.log('[RAG] Memory saved successfully');
    } catch (err) {
      console.error('[RAG] Failed to add memory:', err);
    }
  }

  async recallMemories(userId: string, searchText: string, limit: number = 3) {
    if (!this.model) {
      console.warn('[RAG] No Gemini API key, skipping memory recall');
      return [];
    }
    try {
      console.log(`[RAG] Recalling memories for: "${searchText}"`);
      
      const result = await this.model.embedContent(searchText);
      const embedding = result.embedding.values;

      // Perform vector similarity search
      const res = await query(
        `SELECT content, metadata, 1 - (embedding <=> $2) as similarity 
         FROM knowledge_base 
         WHERE user_id = $1 
         ORDER BY embedding <=> $2 
         LIMIT $3`,
        [userId, JSON.stringify(embedding), limit]
      );

      return res.rows;
    } catch (err) {
      console.error('[RAG] Failed to recall memories:', err);
      return [];
    }
  }

  async summarizeAndStore(userId: string, conversationHistory: string) {
    if (!genAI) return;
    // This could be called at the end of a session
    const summaryModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `Summarize the key facts about this user and their interaction in 1-2 sentences for long-term memory: \n\n${conversationHistory}`;
    
    const result = await summaryModel.generateContent(prompt);
    const summary = result.response.text();
    
    await this.addMemory(userId, summary, { type: 'conversation_summary', timestamp: new Date().toISOString() });
  }
}

export const ragEngine = new RAGEngine();
