import type { NextAuthConfig } from 'next-auth';

// Edge-safe Auth.js config — NO db / redis / node-only imports. Shared by the
// middleware (edge runtime) and the full Node config in auth.ts. Session is a
// JWT signed with NEXTAUTH_SECRET; role is carried in the token.

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
    } & import('next-auth').DefaultSession['user'];
  }
  interface User {
    role?: string;
  }
}

export const authConfig = {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [], // concrete providers are attached in auth.ts (Node runtime)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id ?? token.uid;
        token.role = user.role ?? token.role ?? 'seeker';
      }
      return token;
    },
    session({ session, token }) {
      const uid = token.uid as string | undefined;
      const role = (token.role as string | undefined) ?? 'seeker';
      if (uid) session.user.id = uid;
      session.user.role = role;
      return session;
    },
  },
} satisfies NextAuthConfig;
