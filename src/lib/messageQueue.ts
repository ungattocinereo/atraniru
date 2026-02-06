import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface QueuedMessage {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  telegramText: string;
  metadata: {
    ip: string;
    userAgent: string;
    referer: string;
    acceptLanguage: string;
    dateTime: string;
  };
  retryCount: number;
  lastAttempt: string | null;
  deliveredVia: 'telegram' | 'email' | null;
}

const QUEUE_DIR = process.env.MESSAGE_QUEUE_DIR || './data/queue';
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');
const DELIVERED_DIR = path.join(QUEUE_DIR, 'delivered');

export async function initQueue(): Promise<void> {
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.mkdir(DELIVERED_DIR, { recursive: true });
}

export async function enqueue(message: QueuedMessage): Promise<string> {
  await initQueue();

  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`;
  const filepath = path.join(PENDING_DIR, filename);
  const tmpPath = filepath + '.tmp';

  await fs.writeFile(tmpPath, JSON.stringify(message, null, 2), 'utf-8');
  await fs.rename(tmpPath, filepath);

  return filename;
}

export async function getPendingMessages(): Promise<Array<{ filename: string; message: QueuedMessage }>> {
  try {
    const files = await fs.readdir(PENDING_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort();

    // Get delivered filenames to skip duplicates (if unlink failed after markDelivered)
    let deliveredFiles: Set<string> = new Set();
    try {
      const delivered = await fs.readdir(DELIVERED_DIR);
      deliveredFiles = new Set(delivered);
    } catch { /* ignore */ }

    const results: Array<{ filename: string; message: QueuedMessage }> = [];
    for (const filename of jsonFiles) {
      if (deliveredFiles.has(filename)) {
        // Already delivered — clean up the orphan
        await fs.unlink(path.join(PENDING_DIR, filename)).catch(() => {});
        continue;
      }
      try {
        const content = await fs.readFile(path.join(PENDING_DIR, filename), 'utf-8');
        results.push({ filename, message: JSON.parse(content) });
      } catch {
        console.error(`[MessageQueue] Failed to read ${filename}, skipping`);
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function markDelivered(filename: string, via: 'telegram' | 'email'): Promise<void> {
  const srcPath = path.join(PENDING_DIR, filename);
  const destPath = path.join(DELIVERED_DIR, filename);
  const tmpPath = destPath + '.tmp';

  try {
    const content = await fs.readFile(srcPath, 'utf-8');
    const message: QueuedMessage = JSON.parse(content);
    message.deliveredVia = via;

    // Write delivered copy first, then remove from pending.
    // If unlink fails, the in-flight lock prevents duplicate delivery.
    await fs.writeFile(tmpPath, JSON.stringify(message, null, 2), 'utf-8');
    await fs.rename(tmpPath, destPath);
    await fs.unlink(srcPath).catch(() => {
      // File may already be removed — not critical since delivered copy exists
    });
  } catch (err) {
    console.error(`[MessageQueue] Failed to mark ${filename} as delivered:`, err);
  }
}

export async function updateRetryCount(filename: string): Promise<void> {
  const filepath = path.join(PENDING_DIR, filename);
  const tmpPath = filepath + '.tmp';

  try {
    const content = await fs.readFile(filepath, 'utf-8');
    const message: QueuedMessage = JSON.parse(content);
    message.retryCount++;
    message.lastAttempt = new Date().toISOString();

    await fs.writeFile(tmpPath, JSON.stringify(message, null, 2), 'utf-8');
    await fs.rename(tmpPath, filepath);
  } catch (err) {
    console.error(`[MessageQueue] Failed to update retry count for ${filename}:`, err);
  }
}

export async function cleanupDelivered(maxAgeDays: number = 30): Promise<void> {
  try {
    const files = await fs.readdir(DELIVERED_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    for (const filename of files) {
      if (!filename.endsWith('.json')) continue;

      const timestamp = parseInt(filename.split('-')[0], 10);
      if (isNaN(timestamp)) continue;

      if (now - timestamp > maxAgeMs) {
        await fs.unlink(path.join(DELIVERED_DIR, filename));
      }
    }
  } catch {
    // Directory might not exist yet, ignore
  }
}

export async function cleanupOrphanedTmpFiles(): Promise<void> {
  try {
    const files = await fs.readdir(PENDING_DIR);
    const now = Date.now();
    const maxAgeMs = 60 * 60 * 1000; // 1 hour

    for (const filename of files) {
      if (!filename.endsWith('.tmp')) continue;

      const filepath = path.join(PENDING_DIR, filename);
      const stat = await fs.stat(filepath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.unlink(filepath);
      }
    }
  } catch {
    // Ignore errors
  }
}
