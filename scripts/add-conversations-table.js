const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Try with SSL first, fall back to no SSL if it fails
let pool;

async function createPool() {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    // Test the connection
    const client = await pool.connect();
    client.release();
    return pool;
  } catch (err) {
    // If SSL fails, try without SSL
    console.log('SSL connection failed, trying without SSL...');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    return pool;
  }
}

async function addConversationsTable() {
  await createPool();
  const client = await pool.connect();
  try {
    console.log('Creating conversations table...');
    
    // Create conversations table to store all message exchanges
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES user_dossier(user_id),
        session_id UUID NOT NULL,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        respect_change INT DEFAULT 0,
        respect_score_after INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
      ON conversations(user_id, created_at DESC);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id 
      ON conversations(session_id, created_at);
    `);

    console.log('Conversations table created successfully!');
  } catch (err) {
    console.error('Error creating conversations table:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addConversationsTable();
