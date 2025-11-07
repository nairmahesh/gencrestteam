import "dotenv/config";

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoURI: process.env.MONGO_URI as string,
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    region: process.env.AWS_REGION as string,
    s3BucketName: process.env.AWS_S3_BUCKET_NAME as string,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessTokenExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
  },
  clientURL: process.env.CLIENT_URL || 'http://localhost:5173'
};

// Validate essential config
if (!config.mongoURI) {
  throw new Error("FATAL ERROR: MONGO_URI is not defined.");
}

if (!config.jwt.accessSecret || !config.jwt.refreshSecret) {
  throw new Error('FATAL ERROR: JWT secrets are not defined.');
}

export default config;
