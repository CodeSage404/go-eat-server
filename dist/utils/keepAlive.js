"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startKeepAlivePing = startKeepAlivePing;
const logger_1 = __importDefault(require("./logger"));
const PING_INTERVAL = 3 * 60 * 1000; // 3 minutes
function startKeepAlivePing() {
    const serverUrl = process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server.onrender.com';
    const healthUrl = `${serverUrl}/api/health`;
    logger_1.default.info(`⏰ Initializing self-ping keep-alive service every 3 minutes to: ${healthUrl}`);
    setInterval(async () => {
        try {
            const res = await fetch(healthUrl);
            if (res.ok) {
                logger_1.default.info(`⚡ Keep-alive ping successful to ${healthUrl} (Status: ${res.status})`);
            }
            else {
                logger_1.default.warn(`⚠️ Keep-alive ping warning: ${res.status} ${res.statusText}`);
            }
        }
        catch (err) {
            logger_1.default.error(`❌ Keep-alive ping failed: ${err.message}`);
        }
    }, PING_INTERVAL);
}
