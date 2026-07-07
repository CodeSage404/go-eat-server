import { Router, Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { upload } from '../utils/upload';
import { protect } from '../middleware/auth.middleware';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
  api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret',
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
 *     summary: Upload an image file to Cloudinary
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
 *         description: Image uploaded to Cloudinary successfully
 */
router.post(
  '/cloudinary',
  upload.single('image'),
  catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    // Check if Cloudinary keys are configured
    const isMock = 
      !process.env.CLOUDINARY_CLOUD_NAME || 
      process.env.CLOUDINARY_CLOUD_NAME.startsWith('your_') ||
      process.env.CLOUDINARY_CLOUD_NAME === 'mock_cloud';

    if (isMock) {
      // Fallback mock upload locally
      return res.status(200).json({
        status: 'success',
        data: {
          imageUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
        },
      });
    }

    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'go-eat',
      });
      res.status(200).json({
        status: 'success',
        data: {
          imageUrl: result.secure_url,
        },
      });
    } catch (err: any) {
      throw new AppError(err.message || 'Cloudinary upload failed', 500);
    }
  })
);

export default router;
