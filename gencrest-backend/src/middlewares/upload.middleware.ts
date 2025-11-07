import multer from 'multer';

// We'll use memoryStorage so the service layer can handle S3 upload logic
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 10 MB limit per file
  },
});