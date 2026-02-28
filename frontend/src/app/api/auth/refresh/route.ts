import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies } from '../cookies';


export async function POST(request: NextRequest) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, detail: 'Refresh token missing' },
        { status: 401 }
      );
    }

    const response = await fetch(`${pythonBackendUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${refreshToken}`,
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, detail: payload?.detail || 'Refresh failed' },
        { status: response.status }
      );
    }

    const res = NextResponse.json({ success: true });
    setAuthCookies(res, request, payload);

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
