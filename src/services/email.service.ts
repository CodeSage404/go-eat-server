import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { renderTemplate } from '../utils/templateEngine';

export type EmailSenderChannel = 'default' | 'partners' | 'secure';

export type EmailTemplateType = 
  | 'WELCOME_PARTNER' 
  | 'OTP_VERIFICATION' 
  | 'CREDENTIALS_ALERT' 
  | 'ORDER_CONFIRMED' 
  | 'PASSWORD_RESET'
  | 'WELCOME_USER';

class EmailService {
  /**
   * Helper to fetch the correct user & sender header based on channel
   */
  private getSenderInfo(channel: EmailSenderChannel): { user: string; from: string } {
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
  private createTransporter(user: string): nodemailer.Transporter {
    const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
    const port = Number(process.env.EMAIL_PORT) || 587;
    const password = process.env.EMAIL_PASS;

    return nodemailer.createTransport({
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
    } as any);
  }

  /**
   * Sends a general email with custom HTML/text
   */
  public async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    senderType: EmailSenderChannel = 'default'
  ): Promise<void> {
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
      logger.info(`📩 Email dispatched successfully to ${to} via ${from} (MessageID: ${info.messageId})`);
    } catch (err: any) {
      logger.error(`❌ Failed to send email to ${to} via ${from}: ${err.message}`);
    }
  }

  /**
   * Sends a structured verification OTP code (secure channel)
   */
  public async sendOTP(email: string, otp: string): Promise<void> {
    const htmlContent = renderTemplate('OTP_VERIFICATION', { otpCode: otp, validTime: '10 minutes' });
    this.sendEmail(email, 'Your Go-Eat Verification OTP Code', htmlContent, 'secure')
      .catch(err => logger.error(`Background OTP send failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends a templated email with a preset layout
   */
  public async sendTemplateEmail(
    to: string,
    template: EmailTemplateType,
    subject: string,
    data: Record<string, any>,
    senderType: EmailSenderChannel = 'default'
  ): Promise<void> {
    const htmlContent = renderTemplate(template, data);
    await this.sendEmail(to, subject, htmlContent, senderType);
  }
}

export default new EmailService();
