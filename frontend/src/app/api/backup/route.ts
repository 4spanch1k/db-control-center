import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '@/app/api/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      '/api/backup/create',
      {
      method: 'POST',
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      const errorResponse = NextResponse.json(
        { success: false, error: `Ошибка запуска бэкапа в Python Backend: ${errorData}` },
        { status: response.status }
      );
      if (refreshedSession) {
        setAuthCookies(errorResponse, request, refreshedSession);
      }
      return errorResponse;
    }

    const data = await response.json();
    const successResponse = NextResponse.json({ success: true, data });
    if (refreshedSession) {
      setAuthCookies(successResponse, request, refreshedSession);
    }
    return successResponse;
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
