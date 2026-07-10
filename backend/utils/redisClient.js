// redisClient.js
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const publisher = new Redis(redisUrl);
const subscriber = new Redis(redisUrl);

export { publisher, subscriber };
