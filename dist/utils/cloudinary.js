"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinary = exports.upload = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'placeholder_cloud',
    api_key: process.env.CLOUDINARY_API_KEY || 'placeholder_key',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'placeholder_secret',
});
// Configure Multer Storage
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: 'go-eat-uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }], // Optimize size
    },
});
exports.upload = (0, multer_1.default)({ storage });
