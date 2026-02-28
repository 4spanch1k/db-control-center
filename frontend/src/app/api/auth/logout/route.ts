import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '../cookies';

export async function POST(request: NextRequest) {
  const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';

  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    await fetch(`${pythonBackendUrl}/api/auth/logout`, {
      method: 'POST',
      headers: refreshToken
        ? { Cookie: `refresh_token=${refreshToken}` }
        : undefined,
    });
  } catch {
    // Even if backend call fails, we still clear frontend cookies.
  }

  const res = NextResponse.json({ success: true });
  clearAuthCookies(res, request);
  return res;
}
