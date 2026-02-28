import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PAGE_PATHS = new Set(['/login']);
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

function hasSession(request: NextRequest): boolean {
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  return Boolean(accessToken || refreshToken);
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGE_PATHS.has(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = hasSession(request);

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    if (!authenticated) {
      return NextResponse.json(
        { success: false, detail: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    if (authenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    const nextParam = `${pathname}${search}`;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', nextParam);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
