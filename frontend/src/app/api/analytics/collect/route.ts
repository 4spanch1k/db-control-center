import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '@/app/api/auth/cookies';

/**
 * POST /api/analytics/collect
 * Запустить принудительный сбор аналитики
 * Проксирует запрос к Python backend: POST /api/trigger-analytics
 */
export async function POST(request: NextRequest) {
  try {
    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      '/api/trigger-analytics',
      {
      method: 'POST',
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: errorData.detail || 'Failed to trigger analytics',
        },
        { status: response.status }
      );
      if (refreshedSession) {
        setAuthCookies(errorResponse, request, refreshedSession);
      }
      return errorResponse;
    }

    const data = await response.json();
    const successResponse = NextResponse.json(data, { status: 200 });
    if (refreshedSession) {
      setAuthCookies(successResponse, request, refreshedSession);
    }
    return successResponse;
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
