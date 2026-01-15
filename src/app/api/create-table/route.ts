import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET() {
  try {
    console.log('[Migration] Enabling pgvector...');
    await query('CREATE EXTENSION IF NOT EXISTS vector;');

    console.log('[Migration] Creating user_dossier table...');
    await query(`
      CREATE TABLE IF NOT EXISTS user_dossier (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        respect_score INTEGER DEFAULT 50,
        last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
      );
    `);

    // Insert default user if not exists
    await query(`
      INSERT INTO user_dossier (user_id, respect_score)
      VALUES ('69556352-840f-45ff-9a8a-6b2a2ce074fa', 50)
      ON CONFLICT DO NOTHING;
    `);

    console.log('[Migration] Creating knowledge_base table...');
    await query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('[Migration] Creating index...');
    await query(`
      CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON knowledge_base 
      USING hnsw (embedding vector_cosine_ops);
    `);

    return NextResponse.json({ status: 'migration completed' });
  } catch (err: any) {
    console.error('[Migration] Failed:', err);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
