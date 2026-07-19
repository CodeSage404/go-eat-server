"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../utils/logger"));
const templateEngine_1 = require("../utils/templateEngine");
class EmailService {
    /**
     * Helper to fetch the correct user & sender header based on channel
     */
    getSenderInfo(channel) {
        const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
        const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partner@GoEatOne.com';
        const secureUser = process.env.EMAIL_USER_SECURE || 'verify@GoEatOne.com';
        if (channel === 'partners') {
            return { user: partnersUser, from: `"Go-Eat Partner Support" <${partnersUser}>` };
        }
        if (channel === 'secure') {
            return { user: secureUser, from: `"Go-Eat Security" <${secureUser}>` };
        }
        return { user: defaultUser, from: `"Go-Eat Support" <${defaultUser}>` };
    }
    /**
     * Creates a fresh Nodemailer SMTP transporter per request.
     * Creating a fresh transport per email ensures fresh TCP sockets on cloud hosts (like Render)
     * and completely avoids idle socket disconnection timeouts.
     */
    createTransporter(user) {
        const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
        const port = Number(process.env.EMAIL_PORT) || 587;
        const password = process.env.EMAIL_PASS;
        return nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            requireTLS: port === 587,
            auth: {
                user,
                pass: password,
            },
            tls: {
                rejectUnauthorized: false,
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 12000,
        });
    }
    /**
     * Sends a general email with custom HTML/text
     */
    async sendEmail(to, subject, html, senderType = 'default') {
        const { user, from } = this.getSenderInfo(senderType);
        const transporter = this.createTransporter(user);
        const mailOptions = {
            from,
            to,
            subject,
            html,
        };
        try {
            const info = await transporter.sendMail(mailOptions);
            logger_1.default.info(`📩 Email dispatched successfully to ${to} via ${from} (MessageID: ${info.messageId})`);
        }
        catch (err) {
            logger_1.default.error(`❌ Failed to send email to ${to} via ${from}: ${err.message}`);
        }
    }
    /**
     * Sends a structured verification OTP code (secure channel)
     */
    async sendOTP(email, otp) {
        const htmlContent = (0, templateEngine_1.renderTemplate)('OTP_VERIFICATION', { otpCode: otp, validTime: '10 minutes' });
        this.sendEmail(email, 'Your Go-Eat Verification OTP Code', htmlContent, 'secure')
            .catch(err => logger_1.default.error(`Background OTP send failed to ${email}:`, err?.message || err));
    }
    /**
     * Sends a templated email with a preset layout
     */
    async sendTemplateEmail(to, template, subject, data, senderType = 'default') {
        const htmlContent = (0, templateEngine_1.renderTemplate)(template, data);
        await this.sendEmail(to, subject, htmlContent, senderType);
    }
}
exports.default = new EmailService();
