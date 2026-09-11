import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_URL = process.env.REDIS_URL;

let isReady = false;

const redisOptions: import('ioredis').RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    // Retry interval bertahap (maks 3 detik)
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

export const redis = REDIS_URL ? new Redis(REDIS_URL, redisOptions) : new Redis(redisOptions);

redis.on('connect', () => {
  console.log(`🔌 Menghubungkan ke Redis (${REDIS_URL ? REDIS_URL : `${REDIS_HOST}:${REDIS_PORT}`})...`);
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
