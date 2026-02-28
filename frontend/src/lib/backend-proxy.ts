import { NextRequest } from 'next/server';
import type { AuthTokenPayload } from '@/app/api/auth/cookies';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';

function getBackendUrl(path: string): string {
  return `${PYTHON_BACKEND_URL}${path}`;
}

function normalizeAuthToken(token?: string): string | undefined {
  if (!token) {
    return undefined;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

export function buildBackendHeaders(
  request: NextRequest,
  options?: { accessTokenOverride?: string; extraHeaders?: HeadersInit }
): Headers {
  const headers = new Headers(options?.extraHeaders);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const authHeader = request.headers.get('authorization');
  const accessToken = options?.accessTokenOverride ?? request.cookies.get('access_token')?.value;

  if (authHeader) {
    headers.set('Authorization', authHeader);
    return headers;
  }

  if (accessToken) {
    headers.set('Authorization', normalizeAuthToken(accessToken)!);
  }

  return headers;
}

async function tryRefreshSession(request: NextRequest): Promise<AuthTokenPayload | null> {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(getBackendUrl('/api/auth/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `refresh_token=${refreshToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Partial<AuthTokenPayload>;
  if (
    !payload.access_token ||
    !payload.refresh_token ||
    typeof payload.access_token_expires_in !== 'number' ||
    typeof payload.refresh_token_expires_in !== 'number'
  ) {
    return null;
  }

  return payload as AuthTokenPayload;
}

interface BackendFetchResult {
  response: Response;
  refreshedSession: AuthTokenPayload | null;
}

export async function fetchBackendWithAutoRefresh(
  request: NextRequest,
  path: string,
  init: RequestInit = {}
): Promise<BackendFetchResult> {
  const initialResponse = await fetch(getBackendUrl(path), {
    ...init,
    headers: buildBackendHeaders(request, { extraHeaders: init.headers }),
  });

  if (initialResponse.status !== 401) {
    return { response: initialResponse, refreshedSession: null };
  }

  const refreshedSession = await tryRefreshSession(request);
  if (!refreshedSession) {
    return { response: initialResponse, refreshedSession: null };
  }

  const retriedResponse = await fetch(getBackendUrl(path), {
    ...init,
    headers: buildBackendHeaders(request, {
      accessTokenOverride: refreshedSession.access_token,
      extraHeaders: init.headers,
    }),
  });

  return { response: retriedResponse, refreshedSession };
}
