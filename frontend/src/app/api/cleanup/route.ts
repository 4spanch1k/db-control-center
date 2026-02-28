import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '@/app/api/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      '/api/trigger-cleanup',
      {
      method: 'POST',
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      const errorResponse = NextResponse.json(
        {
          success: false,
          message: payload?.detail || 'Ошибка при запуске очистки',
        },
        { status: response.status }
      );
      if (refreshedSession) {
        setAuthCookies(errorResponse, request, refreshedSession);
      }
      return errorResponse;
    }

    const successResponse = NextResponse.json(
      {
        success: true,
        message: payload?.message || '✅ Очистка запущена! Отчёт придёт в Telegram',
      },
      { status: 200 }
    );
    if (refreshedSession) {
      setAuthCookies(successResponse, request, refreshedSession);
    }
    return successResponse;
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Не удалось связаться с backend',
      },
      { status: 500 }
    );
  }
}
