import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isGenericStaff = session?.user?.email === 'staff@horus.edu.eg';
  const isIndividualStaff = session?.user?.user_metadata?.role === 'staff';
  const userMetadata = session?.user?.user_metadata || {};
  const isStaffAccount = session?.user?.email === 'staff@horus.edu.eg' || userMetadata.role === 'staff';
  const isAdminReportsAccount = userMetadata.role === 'admin_reports';

  // If there's no session and the user is trying to access a protected route
  if (!session && !req.nextUrl.pathname.startsWith('/login') && !req.nextUrl.pathname.startsWith('/images/')) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  // If a generic staff or lecturer tries to access non-staff routes, redirect them to the staff portal
  if (session && isStaffAccount) {
    if (!req.nextUrl.pathname.startsWith('/staff-portal') && !req.nextUrl.pathname.startsWith('/images/')) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/staff-portal';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If the admin_reports account tries to access anything other than /admin-reports, lock them into their portal
  if (session && isAdminReportsAccount) {
    if (!req.nextUrl.pathname.startsWith('/admin-reports') && !req.nextUrl.pathname.startsWith('/images/')) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/admin-reports';
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If there is a session and the user is on the login page, redirect to their respective home
  if (session && req.nextUrl.pathname.startsWith('/login')) {
    const redirectUrl = req.nextUrl.clone();
    if (isStaffAccount) {
      redirectUrl.pathname = '/staff-portal';
    } else if (isAdminReportsAccount) {
      redirectUrl.pathname = '/admin-reports';
    } else {
      redirectUrl.pathname = '/';
    }
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
