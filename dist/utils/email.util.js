"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Dynamic Multi-Channel Email Utility
 * Manages separate connections for info@, partners@, and secure@ email interfaces.
 */
class EmailUtil {
    constructor() {
        const host = process.env.EMAIL_HOST || 'mail.goeatng.com';
        const port = Number(process.env.EMAIL_PORT) || 465;
        const password = process.env.EMAIL_PASS || 'Ukolism_1_16!$';
        // Default info@goeatng.com transporter
        this.defaultTransporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: 'info@goeatng.com',
                pass: password,
            },
            pool: true,
            maxConnections: 5,
        });
        // partners@goeatng.com transporter
        this.partnersTransporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: 'partners@goeatng.com',
                pass: password,
            },
            pool: true,
            maxConnections: 5,
        });
        // secure@goeatng.com transporter
        this.secureTransporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: 'secure@goeatng.com',
                pass: password,
            },
            pool: true,
            maxConnections: 5,
        });
        logger_1.default.info(`📧 Dynamic Email Transporters initialized (info, partners, secure) on ${host}`);
    }
    /**
     * Send a 6-digit OTP verification email using secure@goeatng.com
     */
    async sendOTP(email, otp) {
        const from = '"Go-eat Security" <secure@goeatng.com>';
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #f59e0b; text-align: center;">Go-eat Verification Code</h2>
        <p>Hello,</p>
        <p>Thank you for joining Go-eat! Please use the following code to verify your account. This code is valid for <strong>10 minutes</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111827; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #6b7280;">If you didn't request this code, you can safely ignore this email. The code will expire in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          &copy; 2026 Go-eat. All rights reserved.
        </p>
      </div>
    `;
        try {
            await this.secureTransporter.sendMail({
                from,
                to: email,
                subject: 'Your Go-eat verification code',
                html,
            });
            logger_1.default.info(`📧 OTP email sent to ${email} via secure@goeatng.com`);
        }
        catch (error) {
            logger_1.default.error('❌ Error sending OTP email:', error);
            throw error;
        }
    }
    /**
     * Send a custom email using a specific account (default to info@goeatng.com)
     */
    async sendEmail(to, subject, html, senderType = 'default') {
        let transporter = this.defaultTransporter;
        let from = '"Go-eat Team" <info@goeatng.com>';
        if (senderType === 'partners') {
            transporter = this.partnersTransporter;
            from = '"Go-eat Partners" <partners@goeatng.com>';
        }
        else if (senderType === 'secure') {
            transporter = this.secureTransporter;
            from = '"Go-eat Security" <secure@goeatng.com>';
        }
        try {
            await transporter.sendMail({
                from,
                to,
                subject,
                html,
            });
            logger_1.default.info(`📧 Custom email sent to ${to} via ${from}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error sending custom email via ${from}:`, error);
            throw error;
        }
    }
}
exports.default = new EmailUtil();
