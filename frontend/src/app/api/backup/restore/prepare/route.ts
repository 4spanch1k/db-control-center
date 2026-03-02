import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '@/app/api/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Имя файла не указано' },
        { status: 400 }
      );
    }

    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      '/api/backup/restore/prepare',
      {
        method: 'POST',
        body: JSON.stringify({ filename }),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: payload?.detail || payload?.error || 'Ошибка подготовки восстановления',
        },
        { status: response.status }
      );
      if (refreshedSession) {
        setAuthCookies(errorResponse, request, refreshedSession);
      }
      return errorResponse;
    }

    const successResponse = NextResponse.json({ success: true, data: payload });
    if (refreshedSession) {
      setAuthCookies(successResponse, request, refreshedSession);
    }
    return successResponse;
  } catch (error) {
    console.error('Ошибка prepare restore API:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
