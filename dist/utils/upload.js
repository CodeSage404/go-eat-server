"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDir = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("./logger"));
// Resolve upload directory — use /tmp/uploads inside Docker (always writable),
// or fall back to the local uploads folder in development
const uploadDir = process.env.NODE_ENV === 'production'
    ? '/tmp/uploads'
    : path_1.default.join(__dirname, '../../uploads');
exports.uploadDir = uploadDir;
// Ensure uploads directory exists with error handling
try {
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
        logger_1.default.info(`📁 Uploads directory created at: ${uploadDir}`);
    }
}
catch (err) {
    logger_1.default.error(`⚠️ Could not create uploads directory at ${uploadDir}: ${err.message}`);
    logger_1.default.warn('Uploads will use system temp directory as fallback.');
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the dir exists on every request in case it was cleaned up
        try {
            if (!fs_1.default.existsSync(uploadDir)) {
                fs_1.default.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
        }
        catch (err) {
            cb(new Error(`Upload directory unavailable: ${err.message}`), '');
        }
    },
    filename: (req, file, cb) => {
        // Generate unique name: timestamp + random characters + original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const ext = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
        return cb(null, true);
    }
    cb(new Error('Only images (jpg, jpeg, png, webp) and PDFs are allowed!'));
};
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter,
});
