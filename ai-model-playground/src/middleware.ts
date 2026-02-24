import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CookieName } from '@/types/enums';

// Routes that require authentication (page routes only)
const PROTECTED_PAGE_ROUTES = ['/history'];

// Routes that should redirect authenticated users (e.g., login/register)
const AUTH_ROUTES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(CookieName.ACCESS_TOKEN)?.value;

  // Protect page routes that require authentication
  if (PROTECTED_PAGE_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from login/register pages
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (accessToken) {
      return NextResponse.redirect(new URL('/compare', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled by their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (browser favicon)
     * - public assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
