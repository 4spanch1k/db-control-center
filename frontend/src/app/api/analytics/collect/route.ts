import { NextRequest, NextResponse } from 'next/server';
import { buildBackendHeaders } from '@/lib/backend-proxy';

/**
 * POST /api/analytics/collect
 * Запустить принудительный сбор аналитики
 * Проксирует запрос к Python backend: POST /api/trigger-analytics
 */
export async function POST(request: NextRequest) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';

    const response = await fetch(`${pythonBackendUrl}/api/trigger-analytics`, {
      method: 'POST',
      headers: buildBackendHeaders(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: errorData.detail || 'Failed to trigger analytics',
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error triggering analytics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to communicate with backend',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
