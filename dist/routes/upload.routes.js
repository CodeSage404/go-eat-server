"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cloudinary_1 = require("../utils/cloudinary");
const auth_middleware_1 = require("../middleware/auth.middleware");
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
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
router.post('/image', cloudinary_1.upload.single('image'), (0, catchAsync_1.catchAsync)(async (req, res) => {
    if (!req.file) {
        throw new appError_1.default('No image file provided', 400);
    }
    res.status(200).json({
        status: 'success',
        data: {
            imageUrl: req.file.path, // Cloudinary URL
        },
    });
}));
exports.default = router;
