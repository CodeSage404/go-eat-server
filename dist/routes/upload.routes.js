"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cloudinary_1 = require("cloudinary");
const upload_1 = require("../utils/upload");
const auth_middleware_1 = require("../middleware/auth.middleware");
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'mock_cloud',
    api_key: process.env.CLOUDINARY_API_KEY || 'mock_key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'mock_secret',
});
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
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
router.post('/image', upload_1.upload.single('image'), (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.file) {
        throw new appError_1.default('No image file provided', 400);
    }
    res.status(200).json({
        status: 'success',
        data: {
            imageUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
        },
    });
}));
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
router.post('/cloudinary', upload_1.upload.single('image'), (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.file) {
        throw new appError_1.default('No image file provided', 400);
    }
    // Check if Cloudinary keys are configured
    const isMock = !process.env.CLOUDINARY_CLOUD_NAME ||
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
        const result = await cloudinary_1.v2.uploader.upload(req.file.path, {
            folder: 'go-eat',
        });
        res.status(200).json({
            status: 'success',
            data: {
                imageUrl: result.secure_url,
            },
        });
    }
    catch (err) {
        throw new appError_1.default(err.message || 'Cloudinary upload failed', 500);
    }
}));
exports.default = router;
