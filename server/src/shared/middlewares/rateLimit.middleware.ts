import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

/**
 * In-memory sliding/fixed window rate limiter.
 * Mencegah serangan brute-force, scraping, dan resource exhaustion tanpa dependensi pihak ketiga.
 */
export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  const store: RateLimitStore = {};

  // Pembersihan memory berkala tiap 5 menit
  const timer = setInterval(() => {
    const now = Date.now();
    for (const ip in store) {
      if (store[ip].resetTime <= now) {
        delete store[ip];
      }
    }
  }, 5 * 60 * 1000);
  
  if (timer.unref) {
    timer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket.remoteAddress ||
      'client-ip';

    const now = Date.now();
    const entry = store[ip];

    if (!entry || entry.resetTime <= now) {
      store[ip] = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (entry.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        message: options.message || 'Terlalu banyak permintaan. Silakan coba kembali beberapa saat lagi.',
      });
      return;
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - entry.count));
    next();
  };
};

export const publicNikRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 menit
  maxRequests: 30, // Maksimal 30 pengecekan per menit per IP
  message: 'Batas pencarian data tercapai. Demi privasi dan keamanan data warga, silakan coba kembali dalam 1 menit.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 menit
  maxRequests: 20, // Maksimal 20 percobaan login / register per 5 menit
  message: 'Terlalu banyak percobaan autentikasi. Demi keamanan, silakan coba kembali setelah 5 menit.',
});
