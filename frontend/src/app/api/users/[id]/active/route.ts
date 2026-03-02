import { NextRequest, NextResponse } from 'next/server';
import { fetchBackendWithAutoRefresh } from '@/lib/backend-proxy';
import { setAuthCookies } from '@/app/api/auth/cookies';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const { response, refreshedSession } = await fetchBackendWithAutoRefresh(
      request,
      `/api/users/${id}/active`,
      {
        method: 'PATCH',
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
