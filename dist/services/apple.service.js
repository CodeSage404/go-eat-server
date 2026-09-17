"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appleService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const apple_signin_auth_1 = __importDefault(require("apple-signin-auth"));
const logger_1 = __importDefault(require("../utils/logger"));
const appError_1 = __importDefault(require("../utils/appError"));
class AppleService {
    constructor() {
        this.privateKey = null;
        this.loadPrivateKey();
    }
    /**
     * Loads the Apple Private Key from apple-auth.txt or environment variable
     */
    loadPrivateKey() {
        if (this.privateKey)
            return this.privateKey;
        // 1. Direct environment variable (standard in production/Render/Docker)
        if (process.env.APPLE_PRIVATE_KEY) {
            this.privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
            logger_1.default.info('🍏 Apple private key loaded from APPLE_PRIVATE_KEY env var.');
            return this.privateKey;
        }
        // 2. File path (defaults to apple-auth.txt in server root)
        const possiblePaths = [
            process.env.APPLE_PRIVATE_KEY_PATH ? path_1.default.resolve(process.cwd(), process.env.APPLE_PRIVATE_KEY_PATH) : null,
            path_1.default.resolve(process.cwd(), 'apple-auth.txt'),
            path_1.default.resolve(__dirname, '../../apple-auth.txt'),
            path_1.default.resolve(__dirname, '../../../apple-auth.txt'),
        ].filter(Boolean);
        for (const filePath of possiblePaths) {
            if (fs_1.default.existsSync(filePath)) {
                try {
                    this.privateKey = fs_1.default.readFileSync(filePath, 'utf8').trim();
                    logger_1.default.info(`🍏 Apple private key loaded successfully from: ${filePath}`);
                    return this.privateKey;
                }
                catch (err) {
                    logger_1.default.warn(`Failed reading Apple private key at ${filePath}: ${err.message}`);
                }
            }
        }
        logger_1.default.warn('⚠️ Apple private key not found in apple-auth.txt or APPLE_PRIVATE_KEY env var.');
        return null;
    }
    /**
     * Returns valid Apple Client IDs / App Bundle Identifiers
     */
    getAllowedClientIds() {
        const list = [
            process.env.APPLE_CLIENT_ID,
            'com.emmanuelnwafor.goeat',
            'com.emmanuelnwafor.goeatpartners',
        ].filter(Boolean);
        // If comma-separated in APPLE_CLIENT_ID, split them
        if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_ID.includes(',')) {
            list.push(...process.env.APPLE_CLIENT_ID.split(',').map((id) => id.trim()));
        }
        return Array.from(new Set(list));
    }
    /**
     * Generates a signed Apple Client Secret JWT using the private key
     */
    getClientSecret(clientId) {
        const privateKey = this.loadPrivateKey();
        if (!privateKey) {
            throw new appError_1.default('Apple private key is not configured on the server.', 500);
        }
        const teamID = process.env.APPLE_TEAM_ID;
        const keyIdentifier = process.env.APPLE_KEY_ID;
        const clientID = clientId || process.env.APPLE_CLIENT_ID || 'com.emmanuelnwafor.goeat';
        if (!teamID || !keyIdentifier) {
            throw new appError_1.default('APPLE_TEAM_ID and APPLE_KEY_ID environment variables are required to generate Apple client secret.', 500);
        }
        return apple_signin_auth_1.default.getClientSecret({
            clientID,
            teamID,
            keyIdentifier,
            privateKey,
            expAfter: 15777000, // ~6 months (Apple max allowed expiration)
        });
    }
    /**
     * Verifies an Apple Identity Token (JWT) sent by iOS or Web client
     */
    async verifyIdToken(idToken) {
        const allowedAudiences = this.getAllowedClientIds();
        try {
            const payload = await apple_signin_auth_1.default.verifyIdToken(idToken, {
                audience: allowedAudiences.length > 1 ? allowedAudiences : allowedAudiences[0],
                ignoreExpiration: false,
            });
            return payload;
        }
        catch (err) {
            logger_1.default.error('❌ [Apple Auth Verification Failed]:', err.message || err);
            throw new appError_1.default(`Invalid Apple identity token: ${err.message || 'Verification failed'}`, 401);
        }
    }
    /**
     * Exchanges an authorization code with Apple token endpoint (optional)
     */
    async exchangeCode(code, clientId, redirectUri = '') {
        const clientSecret = this.getClientSecret(clientId);
        const clientID = clientId || process.env.APPLE_CLIENT_ID || 'com.emmanuelnwafor.goeat';
        return await apple_signin_auth_1.default.getAuthorizationToken(code, {
            clientID,
            clientSecret,
            redirectUri,
        });
    }
    /**
     * Revokes Apple user tokens (for Apple account deletion compliance Guideline 5.1.1(v))
     */
    async revokeToken(token, type = 'refresh_token', clientId) {
        const clientSecret = this.getClientSecret(clientId);
        const clientID = clientId || process.env.APPLE_CLIENT_ID || 'com.emmanuelnwafor.goeat';
        await apple_signin_auth_1.default.revokeAuthorizationToken(token, {
            clientID,
            clientSecret,
            tokenTypeHint: type,
        });
    }
}
exports.appleService = new AppleService();
