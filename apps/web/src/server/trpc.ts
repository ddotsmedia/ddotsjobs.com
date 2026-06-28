import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db } from '@ddotsjobs/db';
import { redis } from '@ddotsjobs/redis';
import { auth } from '@/lib/auth';

// tRPC context — built per request. Carries db, redis and the auth session.
export async function createContext(opts: { headers: Headers }) {
  const session = await auth();
  return { db, redis, session, headers: opts.headers };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Never leak internals (stack/SQL/paths) to clients in production.
    const isInternal = shape.data?.code === 'INTERNAL_SERVER_ERROR';
    const masked = isInternal && process.env.NODE_ENV === 'production';
    if (masked) console.error('[trpc] internal error:', error);
    return {
      ...shape,
      message: masked ? 'Something went wrong. Please try again.' : shape.message,
      data: {
        ...shape.data,
        zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
        ...(masked ? { stack: undefined } : {}),
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

// Requires an authenticated session.
const enforceAuth = middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.session.user } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

// Requires a specific role.
export function roleProcedure(...roles: string[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next();
  });
}
