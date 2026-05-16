"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const redis_1 = require("./config/redis");
const logger_1 = __importDefault(require("./utils/logger"));
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
        // Connect to Redis
        await (0, redis_1.connectRedis)();
        // Start Listening
        app_1.default.listen(PORT);
    }
    catch (error) {
        logger_1.default.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
