"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, printf, colorize, align } = winston_1.default.format;
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});
const logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), align(), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize({ all: true }), logFormat),
        }),
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
    ],
});
exports.default = logger;
