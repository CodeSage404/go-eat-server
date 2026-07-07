import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { upload } from '../utils/upload';
import { protect } from '../middleware/auth.middleware';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// In-memory multer for Cloudinary (no disk write needed)
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(file.originalname.toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only images (jpg, jpeg, png, webp) are allowed!'));
  },
});

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/upload/image:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload an image file to local storage (cPanel fallback)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 */
router.post(
  '/image',
  upload.single('image'),
  catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    res.status(200).json({
      status: 'success',
      data: {
        imageUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
      },
    });
  })
);

/**
 * @openapi
 * /api/v1/upload/cloudinary:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: Upload an image file to Cloudinary and receive a hosted URL
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (jpg, jpeg, png, webp, max 10MB)
 *     responses:
 *       200:
 *         description: Image uploaded to Cloudinary successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     imageUrl:
 *                       type: string
 *                       example: https://res.cloudinary.com/dqtjja88b/image/upload/v1234567890/sample.jpg
 *       400:
 *         description: No image provided or unsupported file type
 *       500:
 *         description: Cloudinary upload error
 */
router.post(
  '/cloudinary',
  memUpload.single('image'),
  catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    // Upload buffer directly to Cloudinary — no folder, returns hosted URL
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (err, result) => {
          if (err || !result) return reject(err || new Error('Cloudinary upload failed'));
          resolve(result);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.status(200).json({
      status: 'success',
      data: {
        imageUrl: result.secure_url,
      },
    });
  })
);

export default router;
