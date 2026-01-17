import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from './db';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export class RAGEngine {
  private getModel() {
    if (!genAI) return null;
    return genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }

  async addMemory(userId: string, content: string, metadata: any = {}) {
    try {
      const model = this.getModel();
      if (!model) {
        console.warn('[RAG] Skipping addMemory: GEMINI_API_KEY is not set.');
        return;
      }
      console.log(`[RAG] Generating embedding for memory: "${content.substring(0, 50)}..."`);
      
      const result = await model.embedContent(content);
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
    try {
      const model = this.getModel();
      if (!model) {
        console.warn('[RAG] Skipping recallMemories: GEMINI_API_KEY is not set.');
        return [];
      }
      console.log(`[RAG] Recalling memories for: "${searchText}"`);
      
      const result = await model.embedContent(searchText);
      const embedding = result.embedding.values;

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
    try {
      if (!genAI) {
        console.warn('[RAG] Skipping summarizeAndStore: GEMINI_API_KEY is not set.');
        return;
      }
      const summaryModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
      const prompt = `Summarize the key facts about this user and their interaction in 1-2 sentences for long-term memory: \n\n${conversationHistory}`;
      
      const result = await summaryModel.generateContent(prompt);
      const summary = result.response.text();
      
      await this.addMemory(userId, summary, { type: 'conversation_summary', timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('[RAG] Failed to summarize and store memory:', err);
    }
  }
}

export const ragEngine = new RAGEngine();
