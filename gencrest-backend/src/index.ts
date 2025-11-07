import "dotenv/config";
import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import config from "./config";
import { logger } from "./utils/logger";
import { connectDB } from "./lib/mongoose";
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import dashboradRoutes from './routes/dashboard.routes';
import liquidationRoutes from './routes/liquidation.routes';
import retailerRoutes from './routes/retailer.routes';
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

    app.get("/health", (_req, res) => res.status(200).json({ status: "UP" }));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/admin', adminRoutes)
    app.use('/api/v1/dashboard', dashboradRoutes);
    app.use('/api/v1/liquidation', liquidationRoutes);
    app.use('/api/v1/retailer', retailerRoutes);

    app.listen(config.port, () => {
      logger.info(`✅ Server is running on port ${config.port}`);
    });
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start server");
    process.exit(1);
  }
};
startServer();
