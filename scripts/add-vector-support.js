const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  const client = await pool.connect();
  try {
    console.log('--- Database Migration: pgvector & RAG support ---');

    console.log('1. Enabling pgvector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    console.log('2. Creating knowledge_base table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('3. Creating HNSW index for vector search...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON knowledge_base 
      USING hnsw (embedding vector_cosine_ops);
    `);

    console.log('--- Migration completed successfully ---');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
