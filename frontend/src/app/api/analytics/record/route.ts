import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * POST /api/analytics/record
 * Записывает новую запись аналитики в БД
 *
 * Тело запроса:
 * {
 *   "total_backups_size": 1234567890,
 *   "backups_count": 10,
 *   "db_tables_count": 25,
 *   "indexes_size": 987654321,
 *   "active_connections": 5,
 *   "db_size": 5000000000
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      total_backups_size,
      backups_count,
      db_tables_count,
      indexes_size,
      active_connections,
      db_size = 0,
    } = body;

    // Валидация обязательных параметров
    if (
      typeof total_backups_size !== 'number' ||
      typeof backups_count !== 'number' ||
      typeof db_tables_count !== 'number' ||
      typeof indexes_size !== 'number' ||
      typeof active_connections !== 'number'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          message:
            'All numeric fields are required: total_backups_size, backups_count, db_tables_count, indexes_size, active_connections',
        },
        { status: 400 }
      );
    }

    // Вставляем новую запись
    const result = await executeQuery(
      'SELECT insert_analytics_stats($1, $2, $3, $4, $5, $6) as id;',
      [
        total_backups_size,
        backups_count,
        db_tables_count,
        indexes_size,
        active_connections,
        db_size,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Analytics record inserted successfully',
        id: result.rows[0].id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error inserting analytics record', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to insert analytics record',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/record
 * Получает последнюю запись аналитики
 */
export async function GET() {
  try {
    const result = await executeQuery(
      'SELECT * FROM analytics_stats ORDER BY timestamp DESC LIMIT 1;'
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No analytics records found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching analytics record', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics record',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
