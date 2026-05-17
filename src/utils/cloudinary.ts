import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'placeholder_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'placeholder_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'placeholder_secret',
});

// Configure Multer Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'go-eat-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }], // Optimize size
  } as any,
});

export const upload = multer({ storage });
export { cloudinary };
