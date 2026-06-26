import NextAuth, { type NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { and, db, eq, isNull, tables } from '@ddotsjobs/db';
import { authConfig } from './auth.config.js';
import { consumeVerified, writeSession } from './otp.js';

// Node-runtime Auth.js config. Credentials provider completes the phone-OTP
// flow: the tRPC auth.verifyOtp procedure validates the code and writes a
// single-use handoff to Redis; this provider consumes it and mints the JWT.

const providers: Provider[] = [
  Credentials({
    id: 'otp',
    name: 'Phone OTP',
    credentials: { phone: { label: 'Phone', type: 'tel' } },
    async authorize(raw) {
      const phone = typeof raw?.phone === 'string' ? raw.phone : null;
      if (!phone) return null;

      // Single-use handoff proving OTP was just verified for this phone.
      const userId = await consumeVerified(phone);
      if (!userId) return null;

      const [row] = await db
        .select({ id: tables.users.id, role: tables.users.role, nameEn: tables.users.nameEn })
        .from(tables.users)
        .where(and(eq(tables.users.id, userId), isNull(tables.users.deletedAt)))
        .limit(1);
      if (!row) return null;

      await writeSession(row.id, row.role);
      return { id: row.id, role: row.role, name: row.nameEn ?? null };
    },
  }),
];

// Google is secondary — only enabled when its credentials are configured.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

const config: NextAuthConfig = { ...authConfig, providers };

export const { handlers, auth, signIn, signOut } = NextAuth(config);
