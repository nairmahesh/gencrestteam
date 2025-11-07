import IORedis from "ioredis";
import config from "../config";
import { logger } from "../utils/logger";

export const redisConnection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Important for BullMQ
});

redisConnection.on("connect", () => {
  logger.info("🔻 Redis connected successfully.");
});

redisConnection.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
  process.exit(1);
});
