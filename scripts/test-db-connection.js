const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Disable SSL certificate verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Determine if we should use SSL
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

async function testConnection() {
  console.log('Testing database connection...');
  console.log('SSL Mode:', shouldUseSSL ? 'Enabled (with rejectUnauthorized: false)' : 'Disabled');
  
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to database!');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query executed successfully');
    console.log('   Current database time:', result.rows[0].current_time);
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('✅ Found tables:', tables.rows.map(r => r.table_name).join(', '));
    
    client.release();
    await pool.end();
    console.log('\n🎉 Database connection is working perfectly!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  }
}

testConnection();
