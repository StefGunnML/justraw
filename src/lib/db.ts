import { Pool } from 'pg';

// Always disable SSL certificate verification for self-signed certificates
// This is necessary for DigitalOcean Managed Databases and similar services
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Determine if we should use SSL based on DATABASE_URL or environment
const shouldUseSSL = process.env.DATABASE_URL?.includes('sslmode=require') || 
                     process.env.DATABASE_URL?.includes('digitalocean') ||
                     process.env.NODE_ENV === 'production';

const poolConfig: any = {
  connectionString: process.env.DATABASE_URL
};

// Add SSL configuration if needed
if (shouldUseSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
    require: false
  };
}

const pool = new Pool(poolConfig);

// Log database connection info (masked)
if (process.env.DATABASE_URL) {
  const dbUrl = new URL(process.env.DATABASE_URL);
  console.log('[DB] Connected to:', dbUrl.hostname, 'Database:', dbUrl.pathname, 'SSL:', shouldUseSSL ? 'enabled' : 'disabled');
}

// Handle connection errors gracefully
pool.on('error', (err: Error) => {
  console.error('Unexpected database error:', err);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
