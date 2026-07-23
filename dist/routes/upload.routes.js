"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
const upload_1 = require("../utils/upload");
const auth_middleware_1 = require("../middleware/auth.middleware");
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// In-memory multer for Cloudinary (no disk write needed)
const memUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext = allowed.test(file.originalname.toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime)
            return cb(null, true);
        cb(new Error('Only images (jpg, jpeg, png, webp) are allowed!'));
    },
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
            imageUrl: req.file.path,
        },
    });
}));
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
router.post('/cloudinary', memUpload.single('image'), (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.file) {
        throw new appError_1.default('No image file provided', 400);
    }
    // Upload buffer directly to Cloudinary — no folder, returns hosted URL
    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary_1.v2.uploader.upload_stream({ resource_type: 'image' }, (err, result) => {
            if (err || !result)
                return reject(err || new Error('Cloudinary upload failed'));
            resolve(result);
        });
        stream.end(req.file.buffer);
    });
    res.status(200).json({
        status: 'success',
        data: {
            imageUrl: result.secure_url,
        },
    });
}));
exports.default = router;
