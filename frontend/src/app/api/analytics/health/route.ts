import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

/**
 * GET /api/analytics/health
 * Получает информацию о здоровье базы данных
 */
export async function GET() {
  try {
    const result = await executeQuery(
      'SELECT * FROM get_database_health_info();'
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No health info available',
        },
        { status: 404 }
      );
    }

    const data = result.rows[0];

    // Расчет статуса здоровья
    let status = 'healthy';
    if (data.active_connections > 50) {
      status = 'critical';
    } else if (data.active_connections > 30) {
      status = 'warning';
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        status,
        health_score: calculateHealthScore(data),
      },
    });
  } catch (error) {
    console.error('Error fetching database health', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch database health info',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

interface HealthData {
  active_connections: number;
  idle_connections: number;
  total_connections: number;
  [key: string]: unknown;
}

function calculateHealthScore(data: HealthData): number {
  let score = 100;

  // Снижение за активные соединения
  if (data.active_connections > 50) score -= 20;
  else if (data.active_connections > 30) score -= 10;

  // Снижение за холостые соединения
  if (data.idle_connections > 20) score -= 5;

  // Снижение если мало активных соединений
  if (data.total_connections > 100 && data.active_connections < 5) score -= 5;

  return Math.max(0, score);
}
