import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * GET /api/analytics/summary
 * Получает сводку данных для дашборда
 */
export async function GET() {
  try {
    const result = await executeQuery(
      'SELECT * FROM get_dashboard_summary();'
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No dashboard summary available',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching dashboard summary', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
