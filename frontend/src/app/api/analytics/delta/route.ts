import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * GET /api/analytics/delta
 * Получает информацию о сэкономленном месте и эффективности
 */
export async function GET() {
  try {
    const result = await executeQuery(
      'SELECT * FROM get_analytics_delta();'
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No delta analytics available',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching analytics delta', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics delta',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
