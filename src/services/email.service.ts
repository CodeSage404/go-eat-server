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

  private isDefaultFallback = false;
  private isPartnersFallback = false;
  private isSecureFallback = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeTransporters();
  }

  /**
   * Initializes all SMTP transporters with fallback capabilities
   */
  private async initializeTransporters() {
    const host = process.env.EMAIL_HOST || 'mail.GoEatOne.com';
    const port = Number(process.env.EMAIL_PORT) || 465;
    const password = process.env.EMAIL_PASS;

    const defaultUser = process.env.EMAIL_USER_DEFAULT || 'support@GoEatOne.com';
    const partnersUser = process.env.EMAIL_USER_PARTNERS || 'partners@GoEatOne.com';
    const secureUser = process.env.EMAIL_USER_SECURE || 'secure@GoEatOne.com';

    // 1. Initialize default
    try {
      this.defaultTransporter = nodemailer.createTransport({
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
      } as any);
      if (process.env.NODE_ENV !== 'test') {
        this.defaultTransporter.verify().then(() => {
          logger.info(`📧 SMTP verified for ${defaultUser}`);
        }).catch(err => {
          logger.warn(`⚠️ ${defaultUser} SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
          this.isDefaultFallback = true;
          this.setupEtherealFallback('default');
        });
      }
    } catch (err: any) {
      logger.warn(`⚠️ ${defaultUser} SMTP initialization failed: ${err.message}`);
    }

    // 2. Initialize partners
    try {
      this.partnersTransporter = nodemailer.createTransport({
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
      } as any);
      if (process.env.NODE_ENV !== 'test') {
        this.partnersTransporter.verify().then(() => {
          logger.info(`📧 SMTP verified for ${partnersUser}`);
        }).catch(err => {
          logger.warn(`⚠️ ${partnersUser} SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
          this.isPartnersFallback = true;
          this.setupEtherealFallback('partners');
        });
      }
    } catch (err: any) {
      logger.warn(`⚠️ ${partnersUser} SMTP initialization failed: ${err.message}`);
    }

    // 3. Initialize secure
    try {
      this.secureTransporter = nodemailer.createTransport({
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
      } as any);
      if (process.env.NODE_ENV !== 'test') {
        this.secureTransporter.verify().then(() => {
          logger.info(`📧 SMTP verified for ${secureUser}`);
        }).catch(err => {
          logger.warn(`⚠️ ${secureUser} SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
          this.isSecureFallback = true;
          this.setupEtherealFallback('secure');
        });
      }
    } catch (err: any) {
      logger.warn(`⚠️ ${secureUser} SMTP initialization failed: ${err.message}`);
    }
  }

  /**
   * Generates a test account on Ethereal to prevent connection crashes in local/parked DNS setups
   */
  private async setupEtherealFallback(channel: EmailSenderChannel) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const mockTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      } as any);

      if (channel === 'default') this.defaultTransporter = mockTransporter;
      if (channel === 'partners') this.partnersTransporter = mockTransporter;
      if (channel === 'secure') this.secureTransporter = mockTransporter;

      logger.info(`✅ Ethereal fallback initialized for channel "${channel}": ${testAccount.user}`);
    } catch (err: any) {
      logger.error(`❌ Failed to set up Ethereal fallback: ${err.message}`);
    }
  }

  /**
   * Helper to fetch the correct transporter based on sender channel type
   */
  private getTransporter(channel: EmailSenderChannel): { transporter: nodemailer.Transporter; from: string; isFallback: boolean } {
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
  public async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    senderType: EmailSenderChannel = 'default'
  ): Promise<void> {
    await this.initPromise;
    const { transporter, from, isFallback } = this.getTransporter(senderType);
    
    if (!transporter) {
      logger.error(`❌ Cannot send email to ${to}: Transporter for ${senderType} not initialized.`);
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
      logger.info(`📩 Email sent to ${to} [Channel: ${senderType}] [fallback: ${isFallback}]`);
      if (isFallback) {
        logger.info(`🔗 Fallback preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (err: any) {
      logger.error(`❌ Failed to send email to ${to}: ${err.message}`);
    }
  }

  /**
   * Sends a structured verification OTP code (secure channel)
   */
  public async sendOTP(email: string, otp: string): Promise<void> {
    const htmlContent = renderTemplate('OTP_VERIFICATION', { otpCode: otp, validTime: '10 minutes' });
    await this.sendEmail(email, 'Your Go-Eat Verification OTP Code', htmlContent, 'secure');
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
