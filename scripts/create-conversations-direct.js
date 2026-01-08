// This script uses the EXACT same database connection as the web app
const path = require('path');
process.chdir(path.join(__dirname, '..'));

// Load environment exactly like the web app does
require('dotenv').config({ path: '.env.local' });

// Disable SSL rejection exactly like the web app
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Pool } = require('pg');

// Use same configuration as web app
const shouldUseSSL = process.env.DATABASE_URL?.includes('sslmode=require') || 
                     process.env.DATABASE_URL?.includes('digitalocean') ||
                     process.env.NODE_ENV === 'production';

const poolConfig = {
  connectionString: process.env.DATABASE_URL
};

if (shouldUseSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
    require: false
  };
}

const pool = new Pool(poolConfig);

async function createConversationsTable() {
  const client = await pool.connect();
  try {
    console.log('Creating conversations table in public schema...');
    
    // Drop if exists (for clean slate)
    await client.query('DROP TABLE IF EXISTS conversations CASCADE');
    console.log('Dropped existing table if any');
    
    // Create table
    await client.query(`
      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        session_id UUID NOT NULL,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        respect_change INT DEFAULT 0,
        respect_score_after INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Created conversations table');
    
    // Create indexes
    await client.query(`
      CREATE INDEX idx_conversations_user_id 
      ON conversations(user_id, created_at DESC)
    `);
    console.log('✅ Created user_id index');
    
    await client.query(`
      CREATE INDEX idx_conversations_session_id 
      ON conversations(session_id, created_at)
    `);
    console.log('✅ Created session_id index');
    
    // Verify it exists
    const check = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'conversations'
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ Verified: conversations table exists in public schema');
    } else {
      console.error('❌ Table was created but cannot be found!');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createConversationsTable();
