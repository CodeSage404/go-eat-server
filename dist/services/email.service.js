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
        this.isDefaultFallback = false;
        this.isPartnersFallback = false;
        this.isSecureFallback = false;
        this.initPromise = this.initializeTransporters();
    }
    /**
     * Initializes all SMTP transporters with fallback capabilities
     */
    async initializeTransporters() {
        const host = process.env.EMAIL_HOST || 'mail.GoEatOne.com';
        const port = Number(process.env.EMAIL_PORT) || 465;
        const password = process.env.EMAIL_PASS;
        const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
        const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partners@GoEatOne.com';
        const secureUser = process.env.EMAIL_USER_SECURE || 'secure@GoEatOne.com';
        // 1. Initialize default
        try {
            this.defaultTransporter = nodemailer_1.default.createTransport({
                host,
                port,
                secure: port === 465,
                auth: {
                    user: defaultUser,
                    pass: password,
                },
                tls: {
                    rejectUnauthorized: false
                },
                timeout: 10000,
            });
            if (process.env.NODE_ENV !== 'test') {
                this.defaultTransporter.verify().then(() => {
                    logger_1.default.info(`📧 SMTP verified for ${defaultUser}`);
                }).catch(err => {
                    logger_1.default.warn(`⚠️ ${defaultUser} SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
                    this.isDefaultFallback = true;
                    this.setupEtherealFallback('default');
                });
            }
        }
        catch (err) {
            logger_1.default.warn(`⚠️ ${defaultUser} SMTP initialization failed: ${err.message}`);
        }
        // 2. Initialize partners
        try {
            this.partnersTransporter = nodemailer_1.default.createTransport({
                host,
                port,
                secure: port === 465,
                auth: {
                    user: partnersUser,
                    pass: password,
                },
                tls: {
                    rejectUnauthorized: false
                },
                timeout: 10000,
            });
            if (process.env.NODE_ENV !== 'test') {
                this.partnersTransporter.verify().then(() => {
                    logger_1.default.info(`📧 SMTP verified for ${partnersUser}`);
                }).catch(err => {
                    logger_1.default.warn(`⚠️ ${partnersUser} SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
                    this.isPartnersFallback = true;
                    this.setupEtherealFallback('partners');
                });
            }
        }
        catch (err) {
            logger_1.default.warn(`⚠️ ${partnersUser} SMTP initialization failed: ${err.message}`);
        }
        // 3. Initialize secure
        try {
            this.secureTransporter = nodemailer_1.default.createTransport({
                host,
                port,
                secure: port === 465,
                auth: {
                    user: secureUser,
                    pass: password,
                },
                tls: {
                    rejectUnauthorized: false
                },
                timeout: 10000,
            });
            if (process.env.NODE_ENV !== 'test') {
                this.secureTransporter.verify().then(() => {
                    logger_1.default.info(`📧 SMTP verified for ${secureUser}`);
                }).catch(err => {
                    logger_1.default.warn(`⚠️ ${secureUser} SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
                    this.isSecureFallback = true;
                    this.setupEtherealFallback('secure');
                });
            }
        }
        catch (err) {
            logger_1.default.warn(`⚠️ ${secureUser} SMTP initialization failed: ${err.message}`);
        }
    }
    /**
     * Generates a test account on Ethereal to prevent connection crashes in local/parked DNS setups
     */
    async setupEtherealFallback(channel) {
        try {
            const testAccount = await nodemailer_1.default.createTestAccount();
            const mockTransporter = nodemailer_1.default.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            if (channel === 'default')
                this.defaultTransporter = mockTransporter;
            if (channel === 'partners')
                this.partnersTransporter = mockTransporter;
            if (channel === 'secure')
                this.secureTransporter = mockTransporter;
            logger_1.default.info(`✅ Ethereal fallback initialized for channel "${channel}": ${testAccount.user}`);
        }
        catch (err) {
            logger_1.default.error(`❌ Failed to set up Ethereal fallback: ${err.message}`);
        }
    }
    /**
     * Helper to fetch the correct transporter based on sender channel type
     */
    getTransporter(channel) {
        const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
        const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partners@GoEatOne.com';
        const secureUser = process.env.EMAIL_USER_SECURE || 'secure@GoEatOne.com';
        if (channel === 'partners') {
            return {
                transporter: this.partnersTransporter,
                from: this.isPartnersFallback ? '"Go-Eat Partner Support" <partners@ethereal.email>' : `"Go-Eat Partner Support" <${partnersUser}>`,
                isFallback: this.isPartnersFallback
            };
        }
        if (channel === 'secure') {
            return {
                transporter: this.secureTransporter,
                from: this.isSecureFallback ? '"Go-Eat Security" <secure@ethereal.email>' : `"Go-Eat Security" <${secureUser}>`,
                isFallback: this.isSecureFallback
            };
        }
        return {
            transporter: this.defaultTransporter,
            from: this.isDefaultFallback ? '"Go-Eat Support" <info@ethereal.email>' : `"Go-Eat Support" <${defaultUser}>`,
            isFallback: this.isDefaultFallback
        };
    }
    /**
     * Sends a general email with custom HTML/text
     */
    async sendEmail(to, subject, html, senderType = 'default') {
        await this.initPromise;
        const { transporter, from, isFallback } = this.getTransporter(senderType);
        if (!transporter) {
            logger_1.default.error(`❌ Cannot send email to ${to}: Transporter for ${senderType} not initialized.`);
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
            logger_1.default.info(`📩 Email sent to ${to} [Channel: ${senderType}] [fallback: ${isFallback}]`);
            if (isFallback) {
                logger_1.default.info(`🔗 Fallback preview URL: ${nodemailer_1.default.getTestMessageUrl(info)}`);
            }
        }
        catch (err) {
            logger_1.default.error(`❌ Failed to send email to ${to}: ${err.message}`);
        }
    }
    /**
     * Sends a structured verification OTP code (secure channel)
     */
    async sendOTP(email, otp) {
        const htmlContent = (0, templateEngine_1.renderTemplate)('OTP_VERIFICATION', { otpCode: otp, validTime: '10 minutes' });
        await this.sendEmail(email, 'Your Go-Eat Verification OTP Code', htmlContent, 'secure');
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
