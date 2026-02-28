import { Pool } from 'pg';

// Используем singleton для переиспользования пула соединений
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'control_center',
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 20,
    });

    // Обработчик ошибок для логирования
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

import { QueryResult } from 'pg';

export async function executeQuery(
  query: string,
  params: unknown[] = []
): Promise<QueryResult> {
  const client = await getPool().connect();
  try {
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
