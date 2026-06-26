import 'server-only';
import { Queue } from 'bullmq';
import { createRawConnection, KEY_PREFIX } from '@ddotsjobs/redis';

// Web-side BullMQ producers. Must use the same prefix/connection conventions as
// the worker (prefix without trailing colon; raw connection, not the keyPrefix
// client). Consumers run in apps/worker.
const prefix = KEY_PREFIX.replace(/:$/, '');
const connection = createRawConnection();

export const aiQueue = new Queue('ai', { connection, prefix });
