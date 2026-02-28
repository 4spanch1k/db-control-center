import { NextRequest } from 'next/server';

export function buildBackendHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get('authorization');
  const accessToken = request.cookies.get('access_token')?.value;

  if (authHeader) {
    return {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    };
  }

  if (accessToken) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return {
    'Content-Type': 'application/json',
  };
}
