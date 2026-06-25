import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { and, db, eq, isNull, tables } from '@ddotsjobs/db';
import { verifyPassword } from './password.js';

// Auth.js v5 — JWT sessions (no DB session table; our users table is canonical).
// Credentials provider authenticates by phone + password.

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }
  interface User {
    role: string;
  }
}

const credentialsSchema = z.object({
  phone: z.string().min(8),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        phone: { label: 'Phone', type: 'tel' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const [row] = await db
          .select({
            id: tables.users.id,
            role: tables.users.role,
            nameEn: tables.users.nameEn,
            email: tables.users.email,
            passwordHash: tables.users.passwordHash,
          })
          .from(tables.users)
          .where(and(eq(tables.users.phone, parsed.data.phone), isNull(tables.users.deletedAt)))
          .limit(1);

        if (!row?.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, row.passwordHash);
        if (!ok) return null;

        return {
          id: row.id,
          role: row.role,
          name: row.nameEn ?? null,
          email: row.email ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      if (token.role) session.user.role = token.role as string;
      return session;
    },
  },
});
