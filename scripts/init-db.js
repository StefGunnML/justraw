const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Creating user_dossier table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_dossier (
        user_id UUID PRIMARY KEY,
        name TEXT DEFAULT 'L’élève',
        respect_score INT DEFAULT 50,
        last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        common_mistakes JSONB DEFAULT '[]',
        memories JSONB DEFAULT '[]'
      );
    `);
    console.log('Table created successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
