import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '@/app/api/auth/cookies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      '/api/billing/checkout',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
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
