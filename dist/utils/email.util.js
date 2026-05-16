"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("./logger"));
class EmailUtil {
    constructor() {
        const port = Number(process.env.EMAIL_PORT) || 465;
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.EMAIL_HOST,
            port: port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            // Enterprise settings for better reliability
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
        });
    }
    async sendOTP(email, otp) {
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #f59e0b; text-align: center;">Go-eat Verification Code</h2>
        <p>Hello,</p>
        <p>Thank you for joining Go-eat! Please use the following code to verify your account. This code is valid for 10 minutes.</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>If you didn't request this code, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          &copy; 2026 Go-eat. All rights reserved.
        </p>
      </div>
    `;
        try {
            await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || '"Go-eat Team" <noreply@goeat.com>',
                to: email,
                subject: 'Verify your Go-eat account',
                html,
            });
            logger_1.default.info(`📧 Verification email sent to ${email}`);
        }
        catch (error) {
            logger_1.default.error('❌ Error sending verification email:', error);
            throw error;
        }
    }
}
exports.default = new EmailUtil();
