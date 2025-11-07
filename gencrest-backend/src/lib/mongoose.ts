import mongoose from "mongoose";
import config from "../config";
import { logger } from "../utils/logger";

export const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(config.mongoURI);
    logger.info("🍃 MongoDB connected successfully.");
  } catch (error) {
    logger.error({ err: error }, "MongoDB connection error");
    process.exit(1);
  }
};
