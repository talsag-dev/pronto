import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/middleware-utils';

export default async function middleware(request: NextRequest) {
  // refresh session and get user
  const { response, user } = await updateSession(request);

  // 1. Authenticated User on Landing Page -> Redirect to Dashboard
  if (user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. Unauthenticated User on Protected Routes -> Redirect to Landing Page
  // Allow access to landing page explicitly
  if (request.nextUrl.pathname === '/') {
    return response;
  }

  // Check if the path is an auth callback or other public path
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return response;
  }

  // Redirect unauthenticated users to landing page
  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
