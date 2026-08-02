"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';
const connectDB = async () => {
    try {
        const conn = await mongoose_1.default.connect(mongodbUri);
        logger_1.default.info(`🚀 Connected to MongoDB: ${conn.connection.host}`);
        // Automatically inspect and rebuild index if email index is not sparse
        try {
            const usersCollection = conn.connection.collection('users');
            const indexes = await usersCollection.indexes();
            const emailIndex = indexes.find(idx => idx.name === 'email_1');
            if (emailIndex && !emailIndex.sparse) {
                logger_1.default.info('⚠️ Found non-sparse email index. Dropping it to rebuild as sparse...');
                await usersCollection.dropIndex('email_1');
                logger_1.default.info('✅ Successfully dropped non-sparse email index! Mongoose will rebuild it as sparse.');
            }
        }
        catch (indexErr) {
            logger_1.default.warn('Could not inspect or drop user email index (collection may not exist yet):', indexErr.message);
        }
        // Automatically ensure all restaurant documents have promo fields
        try {
            const restaurantsCollection = conn.connection.collection('restaurants');
            await restaurantsCollection.updateMany({ $or: [{ hasPromo: { $exists: false } }, { acceptsPromos: { $exists: false } }] }, { $set: { hasPromo: false, acceptsPromos: false, allowStampCards: false, promoText: '' } });
            logger_1.default.info('✅ Verified & migrated promo fields across all restaurant documents.');
        }
        catch (migErr) {
            logger_1.default.warn('Could not migrate restaurant promo fields (collection may not exist yet):', migErr.message);
        }
    }
    catch (error) {
        logger_1.default.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};
// Handle connection events
mongoose_1.default.connection.on('disconnected', () => {
    logger_1.default.warn('⚠️ MongoDB Disconnected');
});
mongoose_1.default.connection.on('reconnected', () => {
    logger_1.default.info('⚡ MongoDB Reconnected');
});
exports.default = connectDB;
