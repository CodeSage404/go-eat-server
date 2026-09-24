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
     * Helper to fetch the correct user & sender header based on channel.
     * Ensures all email addresses are lowercase to strictly match Brevo's verified senders list.
     */
    getSenderInfo(channel) {
        const defaultUser = (process.env.EMAIL_USER_DEFAULT || 'support@goeatone.com').toLowerCase().trim();
        const partnersUser = (process.env.EMAIL_USER_PARTNERS || 'partner@goeatone.com').toLowerCase().trim();
        const secureUser = (process.env.EMAIL_USER_SECURE || 'verify@goeatone.com').toLowerCase().trim();
        if (channel === 'partners') {
            return { user: partnersUser, from: `"Go-Eat Partner Support" <${partnersUser}>` };
        }
        if (channel === 'secure') {
            return { user: secureUser, from: `"Go-Eat Security" <${secureUser}>` };
        }
        return { user: defaultUser, from: `"Go-Eat Support" <${defaultUser}>` };
    }
    /**
     * Dispatches email via Brevo HTTPS REST API (Port 443 - Never blocked by Render firewall)
     */
    async sendViaBrevoHttp(to, subject, html, senderEmail, senderName, apiKey) {
        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail.toLowerCase().trim() },
                    to: [{ email: to.toLowerCase().trim() }],
                    subject,
                    htmlContent: html,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                logger_1.default.info(`⚡ Email dispatched via Brevo HTTPS API to ${to} (MessageID: ${data.messageId || 'ok'})`);
                return true;
            }
            else {
                const errorText = await response.text();
                logger_1.default.warn(`⚠️ Brevo HTTPS API dispatch failed (${response.status}): ${errorText}`);
                return false;
            }
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Brevo HTTPS API request error: ${err.message}`);
            return false;
        }
    }
    /**
     * Dispatches email via Resend HTTPS REST API (Port 443 - Never blocked by Render firewall)
     */
    async sendViaResendHttp(to, subject, html, fromHeader, apiKey) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: fromHeader,
                    to: [to.toLowerCase().trim()],
                    subject,
                    html,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                logger_1.default.info(`⚡ Email dispatched via Resend HTTPS API to ${to} (MessageID: ${data.id || 'ok'})`);
                return true;
            }
            else {
                const errorText = await response.text();
                logger_1.default.warn(`⚠️ Resend HTTPS API dispatch failed (${response.status}): ${errorText}`);
                return false;
            }
        }
        catch (err) {
            logger_1.default.warn(`⚠️ Resend HTTPS API request error: ${err.message}`);
            return false;
        }
    }
    /**
     * Creates an SMTP transporter for a specific port
     */
    createTransporter(user, port) {
        const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
        const password = process.env.EMAIL_PASS;
        return nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            requireTLS: port === 587 || port === 2525,
            auth: {
                user: user.toLowerCase().trim(),
                pass: password,
            },
            tls: {
                rejectUnauthorized: false,
            },
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            socketTimeout: 6000,
        });
    }
    /**
     * Sends an email via HTTPS API (Brevo/Resend) first, or falls back to multi-port SMTP (587, 465, 2525)
     */
    async sendEmail(to, subject, html, senderType = 'default') {
        const { user: senderEmail, from } = this.getSenderInfo(senderType);
        const senderName = senderType === 'partners' ? 'Go-Eat Partner Support' : senderType === 'secure' ? 'Go-Eat Security' : 'Go-Eat Support';
        // 1. Try Brevo HTTPS API if key is present
        if (process.env.BREVO_API_KEY) {
            const ok = await this.sendViaBrevoHttp(to, subject, html, senderEmail, senderName, process.env.BREVO_API_KEY);
            if (ok)
                return;
        }
        // 2. Try Resend HTTPS API if key is present
        if (process.env.RESEND_API_KEY) {
            const ok = await this.sendViaResendHttp(to, subject, html, from, process.env.RESEND_API_KEY);
            if (ok)
                return;
        }
        // 3. Fallback to multi-port SMTP (587, 465, 2525)
        const defaultPort = Number(process.env.EMAIL_PORT) || 587;
        const portsToTry = Array.from(new Set([defaultPort, 587, 465, 2525]));
        const mailOptions = {
            from,
            to,
            subject,
            html,
        };
        let sent = false;
        for (const port of portsToTry) {
            if (sent)
                break;
            try {
                const transporter = this.createTransporter(senderEmail, port);
                const info = await transporter.sendMail(mailOptions);
                logger_1.default.info(`📩 Email dispatched successfully to ${to} via ${from} on Port ${port} (MessageID: ${info.messageId})`);
                sent = true;
            }
            catch (err) {
                logger_1.default.warn(`⚠️ SMTP Port ${port} failed for ${from}: ${err.message}. Trying next port...`);
            }
        }
        if (!sent) {
            logger_1.default.error(`❌ All SMTP ports (${portsToTry.join(', ')}) failed for ${to} on host ${process.env.EMAIL_HOST || 'server390.web-hosting.com'}. Render cloud firewall blocks raw SMTP mail ports.`);
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
    /**
     * Sends a security alert notification when a new device logs into an account
     */
    async sendNewDeviceLoginAlert(email, data) {
        const htmlContent = (0, templateEngine_1.renderTemplate)('NEW_DEVICE_LOGIN', data);
        this.sendEmail(email, 'Security Alert: New device login on your Go-Eat account', htmlContent, 'secure')
            .catch(err => logger_1.default.error(`Background new device alert email failed to ${email}:`, err?.message || err));
    }
    /**
     * Sends a 7-day inactivity re-engagement notification
     */
    async sendInactivityReengagement(email, data) {
        const htmlContent = (0, templateEngine_1.renderTemplate)('INACTIVITY_REENGAGEMENT', data);
        this.sendEmail(email, 'We miss you at Go-Eat! 🍽️ Craving something delicious?', htmlContent, 'default')
            .catch(err => logger_1.default.error(`Background inactivity email failed to ${email}:`, err?.message || err));
    }
    /**
     * Sends a GoEatOne Buddy invitation email
     */
    async sendBuddyInvitation(to, data) {
        const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB;">
        <div style="background-color: #004320; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Go-Eat</h1>
          <p style="color: #A7F3D0; margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">Responsible Purchasing Safeguard</p>
        </div>
        <div style="padding: 32px 24px; color: #1F2937;">
          <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Hello ${data.buddyName},</h2>
          <p style="font-size: 15px; line-height: 24px; color: #4B5563; margin-bottom: 20px;">
            <strong>${data.userName}</strong> has invited you to be their <strong>GoEatOne Buddy</strong> on Go-Eat.
          </p>
          <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; line-height: 22px; color: #166534;">
              🛡️ <strong>What does a GoEatOne Buddy do?</strong><br/>
              A GoEatOne Buddy is an accountability partner who helps encourage responsible purchasing choices (such as alcohol limits). You will <strong>never</strong> see what ${data.userName} orders, their food choices, delivery address, or payment details.
            </p>
          </div>
          <div style="text-align: center; margin: 32px 0 24px 0;">
            <a href="${data.acceptUrl}" style="background-color: #004320; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 600; font-size: 15px; display: inline-block; margin-right: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              Accept Invitation
            </a>
            <a href="${data.declineUrl}" style="background-color: #F3F4F6; color: #4B5563; text-decoration: none; padding: 14px 24px; border-radius: 30px; font-weight: 500; font-size: 14px; display: inline-block;">
              Decline
            </a>
          </div>
          <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 30px;">
            No app download or account creation is required to accept this request.
          </p>
        </div>
        <div style="background-color: #F9FAFB; padding: 16px 24px; text-align: center; border-top: 1px solid #E5E7EB;">
          <p style="margin: 0; font-size: 12px; color: #6B7280;">© ${new Date().getFullYear()} Go-Eat. All rights reserved.</p>
        </div>
      </div>
    `;
        this.sendEmail(to, `${data.userName} invited you to be their GoEatOne Buddy`, htmlContent, 'default')
            .catch(err => logger_1.default.error(`Background buddy invitation email failed to ${to}:`, err?.message || err));
    }
}
exports.default = new EmailService();
