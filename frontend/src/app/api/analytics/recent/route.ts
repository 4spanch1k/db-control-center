import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * GET /api/analytics/recent
 * Получает последние 30 записей аналитики для построения графиков
 */
export async function GET() {
  try {
    const result = await executeQuery(
      'SELECT * FROM get_analytics_recent_30();'
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching analytics', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
