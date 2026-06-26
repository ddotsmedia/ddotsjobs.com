import { db } from './client.js';
import { notifications } from './schema/notifications.js';

export interface CreateNotificationArgs {
  userId: string;
  type: string;
  title: string;
  titleMl?: string | null;
  body?: string | null;
  bodyMl?: string | null;
  actionUrl?: string | null;
}

/**
 * Insert an in-app notification. Shared by web routers + the worker.
 * Errors are swallowed — a notification failure must never crash the caller.
 */
export async function createNotification(args: CreateNotificationArgs): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: args.userId,
      type: args.type,
      title: args.title,
      titleMl: args.titleMl ?? null,
      body: args.body ?? null,
      bodyMl: args.bodyMl ?? null,
      actionUrl: args.actionUrl ?? null,
    });
  } catch (err) {
    console.error('[createNotification] non-fatal:', err instanceof Error ? err.message : err);
  }
}
