import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sql = searchParams.get('query') || 'SELECT current_database(), now()';
    
    // Safety check for QC only
    if (sql.toLowerCase().includes('drop') || sql.toLowerCase().includes('delete') || sql.toLowerCase().includes('truncate')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await query(sql);
    return NextResponse.json({ status: 'ok', result: result.rows });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
