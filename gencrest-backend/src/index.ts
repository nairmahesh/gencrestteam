import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import config from "./config";
import { logger } from "./utils/logger";
import { connectDB } from "./lib/mongoose";
import authRoutes from './routes/auth.routes';
import cookieParser from 'cookie-parser';
const app = express();

// --- Middlewares ---
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(cookieParser());
// Use morgan for HTTP request logging in development
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
}

const startServer = async () => {
  try {
    await connectDB();
    // Redis connection is handled by its own event listener in lib/redis.ts

    app.get("/health", (req, res) => res.status(200).json({ status: "UP" }));

    app.use('/api/v1/auth', authRoutes);

    app.listen(config.port, () => {
      logger.info(`✅ Server is running on port ${config.port}`);
    });
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start server");
    process.exit(1);
  }
};
startServer();
