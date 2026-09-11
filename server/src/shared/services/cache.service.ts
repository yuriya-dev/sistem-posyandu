import { redis, isRedisReady } from '../config/redis';

export const cacheService = {
  /**
   * Mengambil data dari Redis cache.
   * Mengembalikan null jika key tidak ditemukan atau Redis sedang offline.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisReady()) return null;
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      console.warn(`[Cache GET Error] key="${key}":`, err);
      return null;
    }
  },

  /**
   * Menyimpan data ke Redis cache dengan masa berlaku (TTL) dalam detik.
   * Default TTL: 300 detik (5 menit).
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!isRedisReady()) return;
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
    } catch (err) {
      console.warn(`[Cache SET Error] key="${key}":`, err);
    }
  },

  /**
   * Menghapus cache berdasarkan key.
   */
  async del(key: string): Promise<void> {
    if (!isRedisReady()) return;
    try {
      await redis.del(key);
    } catch (err) {
      console.warn(`[Cache DEL Error] key="${key}":`, err);
    }
  },

  /**
   * Menghapus semua cache yang cocok dengan pola (pattern), misal: `posyandu:123:*`.
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!isRedisReady()) return;
    try {
      const stream = redis.scanStream({
        match: pattern,
        count: 100,
      });

      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          const pipeline = redis.pipeline();
          keys.forEach((k) => pipeline.del(k));
          await pipeline.exec();
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });
    } catch (err) {
      console.warn(`[Cache DEL Pattern Error] pattern="${pattern}":`, err);
    }
  },

  /**
   * Pola Cache-Aside: Ambil dari cache, jika tidak ada panggil fetchFn() lalu simpan ke cache.
   */
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetchFn();
    await this.set(key, freshData, ttlSeconds);
    return freshData;
  },
};

export default cacheService;
