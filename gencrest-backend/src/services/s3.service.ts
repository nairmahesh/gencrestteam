import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
import config from "../config";
import { logger } from "../utils/logger";

// Initialize S3 client (AWS SDK v3)
const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Upload file buffer/blob directly to S3 and return the public file URL.
 */
export const uploadFileToS3 = async (
  fileBuffer: Buffer,              // the actual file contents (from req.file or blob)
  originalFileName: string,        // original filename
  contentType: string              // MIME type
) => {
  try {
    // Generate unique key
    const rawBytes = await randomBytes(16);
    const uniqueId = rawBytes.toString("hex");
    const fileExtension = originalFileName.split(".").pop() || "bin";
    const key = `gencrest/media/${uniqueId}.${fileExtension}`;

    // Upload file to S3
    const uploadParams = {
      Bucket: config.aws.s3BucketName,
      Key: key,
      Body: fileBuffer as Buffer<ArrayBufferLike>,
      ContentType: contentType,
      ACL: "public-read" as ObjectCannedACL, // ⚠️ make file publicly accessible (optional)
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Construct public URL
    const fileUrl = `https://${config.aws.s3BucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;

    return { key, fileUrl };
  } catch (error) {
    logger.error("Error uploading file to S3:");
    throw error;
  }
};
