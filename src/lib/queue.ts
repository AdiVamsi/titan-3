/**
 * BullMQ queue setup and management
 * Creates and manages job processing queues with Redis connection
 */

import { Queue, QueueOptions, Worker } from 'bullmq';
import { Redis } from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
};

// Parse REDIS_URL if provided (format: redis://[:password@]host:port)
let redisConnectionConfig = redisConfig;

if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL);
    redisConnectionConfig = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password,
      lazyConnect: true,
    };
  } catch (error) {
    console.error('Invalid REDIS_URL format:', error);
  }
}

// Queue instances cache
const queueInstances: Map<string, Queue> = new Map();

// Connection test state
let redisAvailable = true;
let connectionChecked = false;

/**
 * Check if Redis is available
 */
async function checkRedisConnection(): Promise<boolean> {
  if (connectionChecked && !redisAvailable) {
    return false;
  }

  try {
    const testClient = new Redis(redisConnectionConfig as any);
    await testClient.ping();
    testClient.disconnect();
    redisAvailable = true;
    connectionChecked = true;
    return true;
  } catch (error) {
    console.error('Redis connection check failed:', error instanceof Error ? error.message : error);
    redisAvailable = false;
    connectionChecked = true;
    return false;
  }
}

/**
 * Create or get a queue
 */
export async function getQueue(name: string): Promise<Queue> {
  // Return cached instance if available
  if (queueInstances.has(name)) {
    return queueInstances.get(name)!;
  }

  // Check Redis availability
  const isAvailable = await checkRedisConnection();

  if (!isAvailable) {
    throw new Error(
      `Redis not available. Cannot create queue "${name}". Check REDIS_URL or Redis service.`
    );
  }

  // Create queue
  const queueOptions: QueueOptions = {
    connection: redisConnectionConfig as any,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  };

  const queue = new Queue(name, queueOptions);

  // Store in cache
  queueInstances.set(name, queue);

  return queue;
}

/**
 * Get all active queues
 */
export function getActiveQueues(): Queue[] {
  return Array.from(queueInstances.values());
}

/**
 * Close a specific queue
 */
export async function closeQueue(name: string): Promise<void> {
  const queue = queueInstances.get(name);
  if (queue) {
    await queue.close();
    queueInstances.delete(name);
  }
}

/**
 * Close all queues
 */
export async function closeAllQueues(): Promise<void> {
  const promises = Array.from(queueInstances.values()).map((queue) => queue.close());
  await Promise.all(promises);
  queueInstances.clear();
}

/**
 * Get queue statistics
 */
export async function getQueueStats(name: string): Promise<{
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  const queue = queueInstances.get(name);
  if (!queue) {
    return null;
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.count('wait'),
    queue.count('active'),
    queue.count('completed'),
    queue.count('failed'),
    queue.count('delayed'),
  ]);

  return {
    name,
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

/**
 * Clear a queue (remove all jobs)
 */
export async function clearQueue(name: string): Promise<number> {
  const queue = queueInstances.get(name);
  if (!queue) {
    return 0;
  }

  const removed = await queue.clean(0, 1000, 'wait');
  return removed.length;
}

/**
 * Pre-create standard queues
 * Call this on application startup
 */
export async function initializeQueues(): Promise<{
  ingest: Queue;
  score: Queue;
  packet: Queue;
  apply: Queue;
}> {
  try {
    const ingest = await getQueue('ingest-queue');
    const score = await getQueue('score-queue');
    const packet = await getQueue('packet-queue');
    const apply = await getQueue('apply-queue');

    console.log('All queues initialized successfully');
    return { ingest, score, packet, apply };
  } catch (error) {
    console.error('Failed to initialize queues:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Graceful shutdown helper
 */
export async function gracefulQueueShutdown(): Promise<void> {
  try {
    await closeAllQueues();
    console.log('All queues closed gracefully');
  } catch (error) {
    console.error('Error during queue shutdown:', error instanceof Error ? error.message : error);
  }
}

// Export standard queue names
export const QUEUE_NAMES = {
  INGEST: 'ingest-queue',
  SCORE: 'score-queue',
  PACKET: 'packet-queue',
  APPLY: 'apply-queue',
} as const;
