import { Pool } from 'pg';

// Skip database setup during build time
const isBuilding = !process.env.DATABASE_URL && process.env.NODE_ENV === 'production';

let pool: Pool | null = null;

if (!isBuilding && process.env.DATABASE_URL) {
  // Always disable SSL certificate verification for self-signed certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const shouldUseSSL = process.env.DATABASE_URL.includes('sslmode=require') || 
                       process.env.DATABASE_URL.includes('digitalocean') ||
                       process.env.NODE_ENV === 'production';

  const poolConfig: any = {
    connectionString: process.env.DATABASE_URL
  };

  if (shouldUseSSL) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
      require: false
    };
  }

  pool = new Pool(poolConfig);

  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log('[DB] Connected to:', dbUrl.hostname, 'SSL:', shouldUseSSL ? 'enabled' : 'disabled');
  } catch {
    console.log('[DB] Connected');
  }

  pool.on('error', (err: Error) => {
    console.error('Unexpected database error:', err);
  });
}

export const query = async (text: string, params?: any[]) => {
  if (!pool) {
    throw new Error('Database not configured');
  }
  return pool.query(text, params);
};
