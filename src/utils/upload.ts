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

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
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

/**
 * Determines whether to upload to Cloudinary vs local cPanel storage based on config
 */
export const shouldUseCloudinary = (): boolean => {
  const provider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (provider === 'cpanel' || provider === 'local' || provider === 'disk') {
    return false;
  }
  if (provider === 'cloudinary') {
    return true;
  }
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

/**
 * Save an uploaded file to local disk (cPanel / uploads directory)
 */
export const saveFileLocally = async (
  file: Express.Multer.File,
  req?: Request
): Promise<{ secure_url: string; filename: string }> => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname) || '.jpg';
  const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${cleanName}${ext}`;
  const filePath = path.join(uploadDir, filename);

  await fs.promises.writeFile(filePath, file.buffer);

  const baseUrl =
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (req ? `${req.protocol}://${req.get('host')}` : '');
  const secureUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/uploads/${filename}` : `/uploads/${filename}`;

  return {
    secure_url: secureUrl,
    filename,
  };
};

export const upload = {
  single: (fieldName: string) => {
    return [
      memUpload.single(fieldName),
      async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) return next();
        
        try {
          if (shouldUseCloudinary()) {
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
              
              req.file.path = result.secure_url;
              req.file.filename = result.secure_url.split('/').pop() || result.secure_url;
              return next();
            } catch (cloudErr: any) {
              logger.warn(`Cloudinary upload failed, falling back to cPanel local storage: ${cloudErr.message}`);
              // Automatically fall through to cPanel local disk storage if Cloudinary fails
            }
          }

          // cPanel / Local Disk Upload
          const result = await saveFileLocally(req.file, req);
          req.file.path = result.secure_url;
          req.file.filename = result.filename;
          next();
        } catch (error) {
          next(new AppError('Failed to save uploaded file', 500));
        }
      }
    ];
  },
  fields: (fields: multer.Field[]) => {
    return [
      memUpload.fields(fields),
      async (req: Request, res: Response, next: NextFunction) => {
        if (!req.files) return next();
        
        try {
          const files = req.files as { [fieldname: string]: Express.Multer.File[] };
          const uploadPromises: Promise<void>[] = [];
          
          for (const fieldname in files) {
            for (const file of files[fieldname]) {
              uploadPromises.push(
                (async () => {
                  if (shouldUseCloudinary()) {
                    try {
                      const result = await new Promise<any>((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                          { resource_type: 'auto' },
                          (err, result) => {
                            if (err || !result) return reject(err || new Error('Cloudinary upload failed'));
                            resolve(result);
                          }
                        );
                        stream.end(file.buffer);
                      });
                      file.path = result.secure_url;
                      file.filename = result.secure_url.split('/').pop() || file.originalname;
                      return;
                    } catch (cloudErr: any) {
                      logger.warn(`Cloudinary upload failed for ${fieldname}, falling back to cPanel storage: ${cloudErr.message}`);
                    }
                  }

                  // cPanel / Local Disk Upload
                  const result = await saveFileLocally(file, req);
                  file.path = result.secure_url;
                  file.filename = result.filename;
                })()
              );
            }
          }
          await Promise.all(uploadPromises);
          next();
        } catch (error) {
          next(new AppError('Failed to upload files', 500));
        }
      }
    ];
  }
};

export { uploadDir, memUpload };

