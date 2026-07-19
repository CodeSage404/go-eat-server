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
  private defaultTransporter!: nodemailer.Transporter;
  private partnersTransporter!: nodemailer.Transporter;
  private secureTransporter!: nodemailer.Transporter;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeTransporters();
  }

  /**
   * Initializes all real SMTP transporters
   */
  private async initializeTransporters() {
    const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
    const port = Number(process.env.EMAIL_PORT) || 465;
    const password = process.env.EMAIL_PASS;

    const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
    const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partner@GoEatOne.com';
    const secureUser = process.env.EMAIL_USER_SECURE || 'verify@GoEatOne.com';

    const createSmtpTransport = (user: string) => {
      return nodemailer.createTransport({
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
      } as any);
    };

    // 1. Initialize default
    this.defaultTransporter = createSmtpTransport(defaultUser);
    if (process.env.NODE_ENV !== 'test') {
      this.defaultTransporter.verify().then(() => {
        logger.info(`📧 SMTP verified successfully for ${defaultUser}`);
      }).catch(err => {
        logger.error(`❌ SMTP verification failed for ${defaultUser}: ${err.message}`);
      });
    }

    // 2. Initialize partners
    this.partnersTransporter = createSmtpTransport(partnersUser);
    if (process.env.NODE_ENV !== 'test') {
      this.partnersTransporter.verify().then(() => {
        logger.info(`📧 SMTP verified successfully for ${partnersUser}`);
      }).catch(err => {
        logger.error(`❌ SMTP verification failed for ${partnersUser}: ${err.message}`);
      });
    }

    // 3. Initialize secure
    this.secureTransporter = createSmtpTransport(secureUser);
    if (process.env.NODE_ENV !== 'test') {
      this.secureTransporter.verify().then(() => {
        logger.info(`📧 SMTP verified successfully for ${secureUser}`);
      }).catch(err => {
        logger.error(`❌ SMTP verification failed for ${secureUser}: ${err.message}`);
      });
    }
  }

  /**
   * Helper to fetch the correct transporter based on sender channel type
   */
  private getTransporter(channel: EmailSenderChannel): { transporter: nodemailer.Transporter; from: string } {
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
  public async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    senderType: EmailSenderChannel = 'default'
  ): Promise<void> {
    await this.initPromise;
    const { transporter, from } = this.getTransporter(senderType);
    
    if (!transporter) {
      logger.error(`❌ Cannot send email to ${to}: Transporter for ${senderType} is undefined.`);
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
