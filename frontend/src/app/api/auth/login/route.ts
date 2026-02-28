import { NextRequest, NextResponse } from 'next/server';
import { getCookieConfig } from '../cookies';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';

    const response = await fetch(`${pythonBackendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, detail: payload?.detail || 'Login failed' },
        { status: response.status }
      );
    }

    const res = NextResponse.json({ success: true });
    const cookieConfig = getCookieConfig(request);

    res.cookies.set('access_token', payload.access_token, {
      ...cookieConfig,
      maxAge: payload.access_token_expires_in,
    });

    res.cookies.set('refresh_token', payload.refresh_token, {
      ...cookieConfig,
      maxAge: payload.refresh_token_expires_in,
    });

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
