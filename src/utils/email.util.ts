import nodemailer from 'nodemailer';
import logger from './logger';

class EmailUtil {
  private transporter;

  constructor() {
    const port = Number(process.env.EMAIL_PORT) || 465;
    this.transporter = nodemailer.createTransport({
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

  public async sendOTP(email: string, otp: string): Promise<void> {
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
      logger.info(`📧 Verification email sent to ${email}`);
    } catch (error) {
      logger.error('❌ Error sending verification email:', error);
      throw error;
    }
  }
}

export default new EmailUtil();
