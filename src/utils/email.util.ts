import nodemailer from 'nodemailer';
import logger from './logger';

/**
 * Email Utility
 *
 * Supports two SMTP providers, auto-detected from environment variables:
 *
 *  Gmail (active by default — only needs user + pass):
 *    EMAIL_USER=your-gmail@gmail.com
 *    EMAIL_PASS=<16-char App Password>
 *
 *  cPanel SMTP (set EMAIL_HOST to activate):
 *    EMAIL_HOST=mail.yourdomain.com
 *    EMAIL_PORT=465
 *    EMAIL_USER=no-reply@yourdomain.com
 *    EMAIL_PASS=<cpanel_password>
 *    EMAIL_FROM="Go-eat Team" <no-reply@yourdomain.com>
 *
 *  To switch providers, just update the EMAIL_* values in .env and restart.
 */

class EmailUtil {
  private transporter: nodemailer.Transporter;

  constructor() {
    const useGmail = !process.env.EMAIL_HOST;

    if (useGmail) {
      // nodemailer's built-in Gmail preset — no host/port needed
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      logger.info('📧 Email transporter: Gmail');
    } else {
      // cPanel / custom SMTP
      const port = Number(process.env.EMAIL_PORT) || 465;
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port,
        secure: port === 465,   // true for SSL (465), false for STARTTLS (587)
        requireTLS: port !== 465,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      });
      logger.info(`📧 Email transporter: cPanel (${process.env.EMAIL_HOST}:${port})`);
    }
  }

  /**
   * Send a 6-digit OTP verification email to the given address.
   */
  public async sendOTP(email: string, otp: string): Promise<void> {
    // Derive a sensible "from" address
    const from =
      process.env.EMAIL_FROM ||
      `"Go-eat Team" <${process.env.EMAIL_USER}>`;

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
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Your Go-eat verification code',
        html,
      });
      logger.info(`📧 OTP email sent to ${email}`);
    } catch (error) {
      logger.error('❌ Error sending OTP email:', error);
      throw error;
    }
  }
}

export default new EmailUtil();
