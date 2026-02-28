import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * GET /api/analytics/statistic?period=1 day
 * Получает статистику по периодам (день, неделя, месяц)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '1 day';

    // Валидация периода для безопасности
    const validPeriods = [
      '1 hour',
      '1 day',
      '7 days',
      '30 days',
      '90 days',
      '1 month',
    ];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid period parameter',
        },
        { status: 400 }
      );
    }

    const result = await executeQuery(
      'SELECT * FROM get_analytics_statistic($1::INTERVAL);',
      [period]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No statistics available for this period',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      period,
    });
  } catch (error) {
    console.error('Error fetching analytics statistics', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
