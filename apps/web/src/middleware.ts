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

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    const url = new URL('/login', req.nextUrl);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // admins may traverse any protected area; otherwise role must match.
  if (rule.role && user.role !== rule.role && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/employer/:path*', '/seeker/:path*'],
};
