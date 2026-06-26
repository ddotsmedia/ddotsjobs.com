import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// File storage with Cloudflare R2 (when configured) or a local /tmp fallback.
// Shared by the web app (upload) and the worker (download).

const LOCAL_DIR = '/tmp/ddotsjobs-uploads';
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET ?? 'ddotsjobs-assets';

function r2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  );
}

async function r2Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
}

/** Upload a file. Returns a URL (R2 public URL) or local-serve path. */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (r2Configured()) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await r2Client();
    await client.send(
      new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }),
    );
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? `https://assets.ddotsjobs.com`;
    return `${base}/${key}`;
  }

  console.warn('R2 not configured, using local storage');
  const path = join(LOCAL_DIR, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return `/api/files/${key}`;
}

/** Read a file back by its storage key. */
export async function getFileBuffer(key: string): Promise<Buffer> {
  // key may be a stored URL/path — normalise to the object key.
  const normalized = key
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\/api\/files\//, '')
    .replace(/^\/+/, '');

  if (r2Configured()) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await r2Client();
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: normalized }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(join(LOCAL_DIR, normalized));
}

export { LOCAL_DIR };
