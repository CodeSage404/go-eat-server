import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from './logger';
import { v2 as cloudinary } from 'cloudinary';
import { Request, Response, NextFunction } from 'express';
import AppError from './appError';

// Ensure Cloudinary is configured
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadDir = process.env.NODE_ENV === 'production'
  ? '/tmp/uploads'
  : path.join(__dirname, '../../uploads');

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);

  if (ext && mime) {
    return cb(null, true);
  }
  cb(new Error('Only images (jpg, jpeg, png, webp) and PDFs are allowed!'));
};

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

export const upload = {
  single: (fieldName: string) => {
    return [
      memUpload.single(fieldName),
      async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) return next();
        
        try {
          const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { resource_type: 'auto' },
              (err, result) => {
                if (err || !result) return reject(err || new Error('Cloudinary upload failed'));
                resolve(result);
              }
            );
            stream.end(req.file!.buffer);
          });
          
          // Attach the Cloudinary URL to req.file.path so existing controllers continue to work
          req.file.path = result.secure_url;
          next();
        } catch (error) {
          next(new AppError('Failed to upload image to Cloudinary', 500));
        }
      }
    ];
  }
};

export { uploadDir };
