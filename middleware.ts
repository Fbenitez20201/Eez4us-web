import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith('better-auth'));
}

const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
]);
const PUBLIC_PREFIXES = ['/dev/', '/api/public/'];

// Páginas de auth: si ya hay sesión, mandamos directo al panel.
// Esto rompe la cadena /login → / → /admin y previene el "flicker" del
// back-forward cache cuando el usuario vuelve atrás después de loguearse.
const AUTH_PAGES = new Set(['/login', '/forgot-password', '/reset-password']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = hasSessionCookie(request);

  const isPublic =
    PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!authed && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (authed && AUTH_PAGES.has(pathname)) {
    const response = NextResponse.redirect(new URL('/admin', request.url));
    response.headers.set('cache-control', 'no-store, must-revalidate');
    return response;
  }

  // Páginas autenticadas: nunca cachear (evita back/forward cache stale).
  if (authed && !isPublic) {
    const response = NextResponse.next();
    response.headers.set('cache-control', 'no-store, must-revalidate');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/.*|.*\\..*).*)'],
};
