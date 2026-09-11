import Redis, { RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

let isReady = false;

function createRedisClient(): Redis {
  const commonOptions: RedisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
    lazyConnect: false,
    enableReadyCheck: true,
  };

  // Jika menggunakan URL (misalnya Upstash: rediss://default:password@xxx.upstash.io:6379)
  if (REDIS_URL && REDIS_URL.trim() !== '') {
    const isTls = REDIS_URL.startsWith('rediss://');
    return new Redis(REDIS_URL, {
      ...commonOptions,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });
  }

  // Fallback jika menggunakan host/port terpisah (Docker / lokal)
  const host = process.env.REDIS_HOST || 'localhost';
  const port = Number(process.env.REDIS_PORT) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;

  return new Redis({
    ...commonOptions,
    host,
    port,
    password,
  });
}

export const redis = createRedisClient();

redis.on('connect', () => {
  const target = REDIS_URL 
    ? REDIS_URL.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@') // Mask password di log
    : `${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
  console.log(`🔌 Menghubungkan ke Redis (${target})...`);
});

redis.on('ready', () => {
  isReady = true;
  console.log('✅ Redis siap dan terhubung');
});

redis.on('error', (err) => {
  isReady = false;
  console.warn('⚠️ Redis Error / Tidak terhubung:', err.message);
});

redis.on('close', () => {
  isReady = false;
});

export const isRedisReady = (): boolean => isReady;

export const closeRedis = async (): Promise<void> => {
  try {
    if (isReady) {
      await redis.quit();
      console.log('Redis koneksi ditutup secara graceful');
    }
  } catch (error) {
    console.error('Error saat menutup Redis:', error);
  }
};

export default redis;
