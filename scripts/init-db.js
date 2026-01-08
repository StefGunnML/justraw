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

async function initDb() {
  await createPool();
  const client = await pool.connect();
  try {
    console.log('Updating user_dossier table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_dossier (
        user_id UUID PRIMARY KEY,
        name TEXT DEFAULT 'L’élève',
        respect_score INT DEFAULT 50,
        session_count INT DEFAULT 1,
        last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        common_mistakes JSONB DEFAULT '[]',
        memories JSONB DEFAULT '[]'
      );
    `);
    
    // Add session_count column if it doesn't exist
    try {
      await client.query('ALTER TABLE user_dossier ADD COLUMN IF NOT EXISTS session_count INT DEFAULT 1;');
    } catch (e) {
      console.log('session_count column already exists or error adding it.');
    }

    console.log('Database schema updated successfully.');
  } catch (err) {
    console.error('Error updating database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
