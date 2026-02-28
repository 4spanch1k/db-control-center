import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * GET /api/analytics/current
 * Получает текущее состояние аналитики (последнюю запись)
 */
export async function GET() {
  try {
    const result = await executeQuery(
      'SELECT * FROM get_analytics_current();'
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No analytics data available',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching current analytics', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch current analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
