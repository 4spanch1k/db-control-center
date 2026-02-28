import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE;
const AUTH_COOKIE_SAMESITE = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase();
const AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || undefined;

type SameSite = 'lax' | 'strict' | 'none';

export interface AuthTokenPayload {
  access_token: string;
  refresh_token: string;
  access_token_expires_in: number;
  refresh_token_expires_in: number;
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function resolveSameSite(value: string): SameSite {
  if (value === 'strict' || value === 'none') {
    return value;
  }
  return 'lax';
}

function isSecureRequest(request: NextRequest): boolean {
  const secureOverride = parseBoolean(AUTH_COOKIE_SECURE);
  if (secureOverride !== undefined) {
    return secureOverride;
  }

  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0].trim() === 'https';
  }

  return request.nextUrl.protocol === 'https:';
}

export function getCookieConfig(request: NextRequest) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: resolveSameSite(AUTH_COOKIE_SAMESITE),
    path: '/',
    domain: AUTH_COOKIE_DOMAIN,
  } as const;
}

export function setAuthCookies(
  response: NextResponse,
  request: NextRequest,
  tokens: AuthTokenPayload
) {
  const cookieConfig = getCookieConfig(request);

  response.cookies.set('access_token', tokens.access_token, {
    ...cookieConfig,
    maxAge: tokens.access_token_expires_in,
  });

  response.cookies.set('refresh_token', tokens.refresh_token, {
    ...cookieConfig,
    maxAge: tokens.refresh_token_expires_in,
  });
}

export function clearAuthCookies(response: NextResponse, request: NextRequest) {
  const cookieConfig = getCookieConfig(request);

  response.cookies.set('access_token', '', {
    ...cookieConfig,
    maxAge: 0,
  });

  response.cookies.set('refresh_token', '', {
    ...cookieConfig,
    maxAge: 0,
  });
}
