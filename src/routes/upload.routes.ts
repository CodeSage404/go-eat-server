import { Router, Request, Response } from 'express';
import { upload } from '../utils/cloudinary';
import { protect } from '../middleware/auth.middleware';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

const router = Router();

router.use(protect);

/**
 * @openapi
 * /api/v1/upload/image:
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
        imageUrl: req.file.path, // Cloudinary URL
      },
    });
  })
);

export default router;
