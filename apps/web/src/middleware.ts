import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

// Edge middleware — JWT-only (no db/redis). Protects role-scoped areas.
const { auth } = NextAuth(authConfig);

// path prefix -> required role (null = any authenticated user)
const RULES: { prefix: string; role: string | null }[] = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/employer', role: 'employer' },
  { prefix: '/seeker', role: null },
];

// Auth required but no specific role — the employer on-ramp for any user.
const AUTH_ONLY = ['/employer/register'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    // Admin areas have their own username/password login page.
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin-login', req.nextUrl));
    }
    const url = new URL('/login', req.nextUrl);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const authOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  // admins/super_admins may traverse any protected area; otherwise role must match.
  if (!authOnly && rule.role && user.role !== rule.role && !isAdmin) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/employer/:path*', '/seeker/:path*'],
};
