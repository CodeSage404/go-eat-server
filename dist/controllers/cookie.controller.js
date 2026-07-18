"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
class CookieController {
    constructor() {
        /**
         * Sets the cookie consent preference in the HTTP response cookies
         */
        this.setConsent = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { consent } = req.body;
            if (!consent || (consent !== 'all' && consent !== 'required')) {
                throw new appError_1.default('Consent must be either "all" or "required"', 400);
            }
            // Set cookie: HttpOnly, Secure if production, expires in 1 year
            res.cookie('cookie_consent', consent, {
                maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/'
            });
            res.status(200).json({
                status: 'success',
                message: `Cookie consent set to: ${consent}`,
                data: {
                    consent
                }
            });
        });
        /**
         * Retrieves the current cookie consent preference from HTTP request cookies
         */
        this.getConsent = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const cookieHeader = req.headers.cookie;
            let consent = null;
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|; )cookie_consent=([^;]*)/);
                if (match) {
                    consent = decodeURIComponent(match[1]);
                }
            }
            res.status(200).json({
                status: 'success',
                data: {
                    consent
                }
            });
        });
    }
}
exports.default = new CookieController();
