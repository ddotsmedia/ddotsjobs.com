import pino from 'pino';

// Structured logger. JSON in production, pretty in development.
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});
