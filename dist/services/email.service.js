"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../utils/logger"));
const templateEngine_1 = require("../utils/templateEngine");
class EmailService {
    constructor() {
        this.initPromise = this.initializeTransporters();
    }
    /**
     * Initializes all real SMTP transporters
     */
    async initializeTransporters() {
        const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
        const port = Number(process.env.EMAIL_PORT) || 465;
        const password = process.env.EMAIL_PASS;
        const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
        const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partner@GoEatOne.com';
        const secureUser = process.env.EMAIL_USER_SECURE || 'verify@GoEatOne.com';
        const createSmtpTransport = (user) => {
            return nodemailer_1.default.createTransport({
                host,
                port,
                secure: port === 465, // true for 465 SSL, false for 587 TLS
                auth: {
                    user,
                    pass: password,
                },
                tls: {
                    rejectUnauthorized: false,
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });
        };
        // 1. Initialize default
        this.defaultTransporter = createSmtpTransport(defaultUser);
        if (process.env.NODE_ENV !== 'test') {
            this.defaultTransporter.verify().then(() => {
                logger_1.default.info(`📧 SMTP verified successfully for ${defaultUser}`);
            }).catch(err => {
                logger_1.default.error(`❌ SMTP verification failed for ${defaultUser}: ${err.message}`);
            });
        }
        // 2. Initialize partners
        this.partnersTransporter = createSmtpTransport(partnersUser);
        if (process.env.NODE_ENV !== 'test') {
            this.partnersTransporter.verify().then(() => {
                logger_1.default.info(`📧 SMTP verified successfully for ${partnersUser}`);
            }).catch(err => {
                logger_1.default.error(`❌ SMTP verification failed for ${partnersUser}: ${err.message}`);
            });
        }
        // 3. Initialize secure
        this.secureTransporter = createSmtpTransport(secureUser);
        if (process.env.NODE_ENV !== 'test') {
            this.secureTransporter.verify().then(() => {
                logger_1.default.info(`📧 SMTP verified successfully for ${secureUser}`);
            }).catch(err => {
                logger_1.default.error(`❌ SMTP verification failed for ${secureUser}: ${err.message}`);
            });
        }
    }
    /**
     * Helper to fetch the correct transporter based on sender channel type
     */
    getTransporter(channel) {
        const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
        const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partner@GoEatOne.com';
        const secureUser = process.env.EMAIL_USER_SECURE || 'verify@GoEatOne.com';
        if (channel === 'partners') {
            return {
                transporter: this.partnersTransporter,
                from: `"Go-Eat Partner Support" <${partnersUser}>`,
            };
        }
        if (channel === 'secure') {
            return {
                transporter: this.secureTransporter,
                from: `"Go-Eat Security" <${secureUser}>`,
            };
        }
        return {
            transporter: this.defaultTransporter,
            from: `"Go-Eat Support" <${defaultUser}>`,
        };
    }
    /**
     * Sends a general email with custom HTML/text
     */
    async sendEmail(to, subject, html, senderType = 'default') {
        await this.initPromise;
        const { transporter, from } = this.getTransporter(senderType);
        if (!transporter) {
            logger_1.default.error(`❌ Cannot send email to ${to}: Transporter for ${senderType} is undefined.`);
            return;
        }
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
