import { publisher } from "../utils/redisClient.js";
import AppError from "../utils/appError.js";

/**
 * Redis-backed Rate Limiter Middleware
 * @param {number} limit Max requests within window
 * @param {number} windowSecs Window duration in seconds (default 15 mins)
 */
export const redisRateLimiter = (limit = 100, windowSecs = 900) => {
  return async (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
    const key = `rate:${ip}`;

    try {
      // Increment request count in Redis using the publisher connection client
      const current = await publisher.incr(key);
      
      // If it is a new window, establish TTL expiry
      if (current === 1) {
        await publisher.expire(key, windowSecs);
      }

      if (current > limit) {
        return next(new AppError("Too many requests from this IP. Please try again later.", 429));
      }

      // Append standard API rate limiting headers
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - current));

      next();
    } catch (err) {
      // Fail-open: log Redis rate limit failures but allow traffic to flow to prevent client locks
      console.error("Redis Rate Limiter Error (Failing-Open):", err.message);
      next();
    }
  };
};
