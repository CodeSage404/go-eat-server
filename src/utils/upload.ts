import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from './logger';

// Resolve upload directory — use /tmp/uploads inside Docker (always writable),
// or fall back to the local uploads folder in development
const uploadDir = process.env.NODE_ENV === 'production'
  ? '/tmp/uploads'
  : path.join(__dirname, '../../uploads');

// Ensure uploads directory exists with error handling
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info(`📁 Uploads directory created at: ${uploadDir}`);
  }
} catch (err: any) {
  logger.error(`⚠️ Could not create uploads directory at ${uploadDir}: ${err.message}`);
  logger.warn('Uploads will use system temp directory as fallback.');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the dir exists on every request in case it was cleaned up
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (err: any) {
      cb(new Error(`Upload directory unavailable: ${err.message}`), '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp + random characters + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);

  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error('Only images (jpg, jpeg, png, webp) and PDFs are allowed!'));
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

export { uploadDir };
