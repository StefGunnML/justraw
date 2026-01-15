import { Pool } from 'pg';

const isBuilding = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL;

let pool: Pool | null = null;

if (!isBuilding && process.env.DATABASE_URL) {
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
    console.log('[DB] Initialized for:', dbUrl.hostname, 'SSL:', shouldUseSSL ? 'enabled' : 'disabled');
  } catch {
    console.log('[DB] Initialized');
  }

  pool.on('error', (err: Error) => {
    console.error('Unexpected database error:', err);
  });
} else if (isBuilding) {
  console.log('[DB] Build-time mode: skipping pool initialization');
}

export const query = async (text: string, params?: any[]) => {
  if (!pool) {
    if (isBuilding) {
      console.warn('[DB] Query skipped during build time');
      return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
    }
    throw new Error('Database not initialized - check DATABASE_URL');
  }
  return pool.query(text, params);
};
