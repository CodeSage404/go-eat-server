"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBase64Image = exports.memUpload = exports.uploadDir = exports.upload = exports.saveFileLocally = exports.shouldUseCloudinary = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("./logger"));
const cloudinary_1 = require("cloudinary");
const appError_1 = __importDefault(require("./appError"));
// Ensure Cloudinary is configured
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const uploadDir = process.env.UPLOAD_DIR
    ? path_1.default.resolve(process.env.UPLOAD_DIR)
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
exports.memUpload = memUpload;
/**
 * Determines whether to upload to Cloudinary vs local cPanel storage based on config
 */
const shouldUseCloudinary = () => {
    const provider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
    if (provider === 'cpanel' || provider === 'local' || provider === 'disk') {
        return false;
    }
    if (provider === 'cloudinary') {
        return true;
    }
    return Boolean(process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET);
};
exports.shouldUseCloudinary = shouldUseCloudinary;
/**
 * Save an uploaded file to local disk (cPanel / uploads directory)
 */
const saveFileLocally = async (file, req) => {
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    const ext = path_1.default.extname(file.originalname) || '.jpg';
    const cleanName = path_1.default.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${cleanName}${ext}`;
    const filePath = path_1.default.join(uploadDir, filename);
    await fs_1.default.promises.writeFile(filePath, file.buffer);
    const baseUrl = process.env.APP_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (req ? `${req.protocol}://${req.get('host')}` : '');
    const secureUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/uploads/${filename}` : `/uploads/${filename}`;
    return {
        secure_url: secureUrl,
        filename,
    };
};
exports.saveFileLocally = saveFileLocally;
exports.upload = {
    single: (fieldName) => {
        return [
            memUpload.single(fieldName),
            async (req, res, next) => {
                if (!req.file)
                    return next();
                try {
                    if ((0, exports.shouldUseCloudinary)()) {
                        try {
                            const result = await new Promise((resolve, reject) => {
                                const stream = cloudinary_1.v2.uploader.upload_stream({ resource_type: 'auto' }, (err, result) => {
                                    if (err || !result)
                                        return reject(err || new Error('Cloudinary upload failed'));
                                    resolve(result);
                                });
                                stream.end(req.file.buffer);
                            });
                            req.file.path = result.secure_url;
                            req.file.filename = result.secure_url.split('/').pop() || result.secure_url;
                            return next();
                        }
                        catch (cloudErr) {
                            logger_1.default.warn(`Cloudinary upload failed, falling back to cPanel local storage: ${cloudErr.message}`);
                            // Automatically fall through to cPanel local disk storage if Cloudinary fails
                        }
                    }
                    // cPanel / Local Disk Upload
                    const result = await (0, exports.saveFileLocally)(req.file, req);
                    req.file.path = result.secure_url;
                    req.file.filename = result.filename;
                    next();
                }
                catch (error) {
                    next(new appError_1.default('Failed to save uploaded file', 500));
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
                            uploadPromises.push((async () => {
                                if ((0, exports.shouldUseCloudinary)()) {
                                    try {
                                        const result = await new Promise((resolve, reject) => {
                                            const stream = cloudinary_1.v2.uploader.upload_stream({ resource_type: 'auto' }, (err, result) => {
                                                if (err || !result)
                                                    return reject(err || new Error('Cloudinary upload failed'));
                                                resolve(result);
                                            });
                                            stream.end(file.buffer);
                                        });
                                        file.path = result.secure_url;
                                        file.filename = result.secure_url.split('/').pop() || file.originalname;
                                        return;
                                    }
                                    catch (cloudErr) {
                                        logger_1.default.warn(`Cloudinary upload failed for ${fieldname}, falling back to cPanel storage: ${cloudErr.message}`);
                                    }
                                }
                                // cPanel / Local Disk Upload
                                const result = await (0, exports.saveFileLocally)(file, req);
                                file.path = result.secure_url;
                                file.filename = result.filename;
                            })());
                        }
                    }
                    await Promise.all(uploadPromises);
                    next();
                }
                catch (error) {
                    next(new appError_1.default('Failed to upload files', 500));
                }
            }
        ];
    }
};
/**
 * Process a base64 or URL image and return a persistent URL
 */
const processBase64Image = async (base64String, req) => {
    if (!base64String || typeof base64String !== 'string')
        return '';
    if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
        return base64String;
    }
    // If base64 data URI or raw base64
    if (base64String.startsWith('data:image') || base64String.length > 200) {
        const formatted = base64String.startsWith('data:image')
            ? base64String
            : `data:image/jpeg;base64,${base64String}`;
        if ((0, exports.shouldUseCloudinary)()) {
            try {
                const result = await cloudinary_1.v2.uploader.upload(formatted, {
                    folder: 'combo_items',
                    resource_type: 'image',
                });
                return result.secure_url;
            }
            catch (err) {
                logger_1.default.warn(`Cloudinary base64 upload failed, falling back to local: ${err.message}`);
            }
        }
        try {
            if (!fs_1.default.existsSync(uploadDir)) {
                fs_1.default.mkdirSync(uploadDir, { recursive: true });
            }
            const matches = formatted.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            const ext = matches ? `.${matches[1].replace('jpeg', 'jpg')}` : '.jpg';
            const data = matches ? matches[2] : base64String;
            const buffer = Buffer.from(data, 'base64');
            const filename = `combo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
            const filePath = path_1.default.join(uploadDir, filename);
            await fs_1.default.promises.writeFile(filePath, buffer);
            const baseUrl = process.env.APP_URL ||
                process.env.RENDER_EXTERNAL_URL ||
                (req ? `${req.protocol}://${req.get('host')}` : '');
            return baseUrl ? `${baseUrl.replace(/\/$/, '')}/uploads/${filename}` : `/uploads/${filename}`;
        }
        catch (localErr) {
            logger_1.default.error(`Local base64 save failed: ${localErr.message}`);
        }
    }
    return base64String;
};
exports.processBase64Image = processBase64Image;
