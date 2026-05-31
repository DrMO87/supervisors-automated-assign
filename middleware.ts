import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isStaffAccount = session?.user?.email === 'staff@horus.edu.eg';

  // If there's no session and the user is trying to access a protected route
  if (!session && !req.nextUrl.pathname.startsWith('/login') && !req.nextUrl.pathname.startsWith('/images/')) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // If staff account tries to access anything other than staff-portal or images
  if (session && isStaffAccount) {
    if (!req.nextUrl.pathname.startsWith('/staff-portal') && !req.nextUrl.pathname.startsWith('/images/')) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/staff-portal/swap';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If there is a session and the user is on the login page, redirect to home (or staff portal)
  if (session && req.nextUrl.pathname.startsWith('/login')) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = isStaffAccount ? '/staff-portal/swap' : '/';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
