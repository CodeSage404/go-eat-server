"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDir = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const cloudinary_1 = require("cloudinary");
const appError_1 = __importDefault(require("./appError"));
// Ensure Cloudinary is configured
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const uploadDir = process.env.NODE_ENV === 'production'
    ? '/tmp/uploads'
    : path_1.default.join(__dirname, '../../uploads');
exports.uploadDir = uploadDir;
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const ext = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
        return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, webp) and PDFs are allowed!'));
};
const memUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter,
});
exports.upload = {
    single: (fieldName) => {
        return [
            memUpload.single(fieldName),
            async (req, res, next) => {
                if (!req.file)
                    return next();
                try {
                    const result = await new Promise((resolve, reject) => {
                        const stream = cloudinary_1.v2.uploader.upload_stream({ resource_type: 'auto' }, (err, result) => {
                            if (err || !result)
                                return reject(err || new Error('Cloudinary upload failed'));
                            resolve(result);
                        });
                        stream.end(req.file.buffer);
                    });
                    // Attach the Cloudinary URL to req.file.path so existing controllers continue to work
                    req.file.path = result.secure_url;
                    // Set filename as URL so `filename` usage still gets a valid path if appended blindly
                    req.file.filename = result.secure_url.split('/').pop() || result.secure_url;
                    next();
                }
                catch (error) {
                    next(new appError_1.default('Failed to upload image to Cloudinary', 500));
                }
            }
        ];
    },
    fields: (fields) => {
        return [
            memUpload.fields(fields),
            async (req, res, next) => {
                if (!req.files)
                    return next();
                try {
                    const files = req.files;
                    const uploadPromises = [];
                    for (const fieldname in files) {
                        for (const file of files[fieldname]) {
                            uploadPromises.push(new Promise((resolve, reject) => {
                                const stream = cloudinary_1.v2.uploader.upload_stream({ resource_type: 'auto' }, (err, result) => {
                                    if (err || !result)
                                        return reject(err || new Error('Cloudinary upload failed'));
                                    file.path = result.secure_url;
                                    file.filename = result.secure_url.split('/').pop() || file.originalname;
                                    resolve();
                                });
                                stream.end(file.buffer);
                            }));
                        }
                    }
                    await Promise.all(uploadPromises);
                    next();
                }
                catch (error) {
                    next(new appError_1.default('Failed to upload images to Cloudinary', 500));
                }
            }
        ];
    }
};
