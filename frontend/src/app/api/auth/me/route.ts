import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '../cookies';

export async function GET(request: NextRequest) {
  try {
    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      '/api/auth/me',
      { method: 'GET' }
    );

    const payload = await response.json();
    const res = NextResponse.json(payload, { status: response.status });

    if (refreshedSession) {
      setAuthCookies(res, request, refreshedSession);
    }

    return res;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
