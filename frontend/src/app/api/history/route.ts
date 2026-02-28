import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await executeQuery(
      `
      SELECT
        id,
        COALESCE(filename, '') AS file_path,
        COALESCE(status, 'unknown') AS status,
        created_at,
        action,
        size_bytes
      FROM backup_logs
      ORDER BY created_at DESC
      LIMIT 100
      `
    );

    const dbName = process.env.DB_NAME || 'control_center';

    const rows = result.rows.map((row) => ({
      ...row,
      db_name: dbName,
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка подключения к БД:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения данных' },
      { status: 500 }
    );
  }
}
