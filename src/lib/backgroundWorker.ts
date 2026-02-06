import { initQueue, getPendingMessages, cleanupDelivered, cleanupOrphanedTmpFiles } from './messageQueue';
import { attemptDelivery } from './deliveryService';

let workerStarted = false;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processPendingMessages(): Promise<void> {
  await cleanupDelivered(30);
  await cleanupOrphanedTmpFiles();

  const pending = await getPendingMessages();
  if (pending.length === 0) return;

  console.log(`[Worker] Processing ${pending.length} pending message(s)`);

  for (const { filename, message } of pending) {
    // Skip messages attempted less than 2 minutes ago
    if (message.lastAttempt) {
      const elapsed = Date.now() - new Date(message.lastAttempt).getTime();
      if (elapsed < 2 * 60 * 1000) continue;
    }

    await attemptDelivery(message, filename);
    await sleep(1000);
  }
}

export async function startWorker(): Promise<void> {
  if (workerStarted) return;
  workerStarted = true;

  console.log('[Worker] Background worker starting...');

  await initQueue();

  // Process any pending messages from before restart
  try {
    await processPendingMessages();
  } catch (err) {
    console.error('[Worker] Initial processing error:', err);
  }

  // Retry every 5 minutes
  setInterval(async () => {
    try {
      await processPendingMessages();
    } catch (err) {
      console.error('[Worker] Retry cycle error:', err);
    }
  }, 5 * 60 * 1000);

  console.log('[Worker] Background worker started (retry interval: 5 min)');
}
