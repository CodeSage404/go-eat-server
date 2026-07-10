import nodemailer from 'nodemailer';
import logger from '../utils/logger';

export type EmailSenderChannel = 'default' | 'partners' | 'secure';

export type EmailTemplateType = 
  | 'WELCOME_PARTNER' 
  | 'OTP_VERIFICATION' 
  | 'CREDENTIALS_ALERT' 
  | 'ORDER_CONFIRMED' 
  | 'PASSWORD_RESET';

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
    const host = process.env.EMAIL_HOST || 'mail.goeatng.com';
    const port = Number(process.env.EMAIL_PORT) || 465;
    const password = process.env.EMAIL_PASS || 'Ukolism_1_16!$';

    // 1. Initialize default (info@goeatng.com)
    try {
      this.defaultTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: 'info@goeatng.com',
          pass: password,
        },
        timeout: 5000, // 5s connection timeout
      } as any);
      if (process.env.NODE_ENV !== 'test') {
        await this.defaultTransporter.verify();
        logger.info(`📧 SMTP verified for info@goeatng.com`);
      }
    } catch (err: any) {
      logger.warn(`⚠️ info@goeatng.com SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
      this.isDefaultFallback = true;
      await this.setupEtherealFallback('default');
    }

    // 2. Initialize partners@goeatng.com
    try {
      this.partnersTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: 'partners@goeatng.com',
          pass: password,
        },
        timeout: 5000,
      } as any);
      if (process.env.NODE_ENV !== 'test') {
        await this.partnersTransporter.verify();
        logger.info(`📧 SMTP verified for partners@goeatng.com`);
      }
    } catch (err: any) {
      logger.warn(`⚠️ partners@goeatng.com SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
      this.isPartnersFallback = true;
      await this.setupEtherealFallback('partners');
    }

    // 3. Initialize secure@goeatng.com
    try {
      this.secureTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: 'secure@goeatng.com',
          pass: password,
        },
        timeout: 5000,
      } as any);
      if (process.env.NODE_ENV !== 'test') {
        await this.secureTransporter.verify();
        logger.info(`📧 SMTP verified for secure@goeatng.com`);
      }
    } catch (err: any) {
      logger.warn(`⚠️ secure@goeatng.com SMTP failed: ${err.message}. Enabling mock Ethereal fallback.`);
      this.isSecureFallback = true;
      await this.setupEtherealFallback('secure');
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
    if (channel === 'partners') {
      return {
        transporter: this.partnersTransporter,
        from: this.isPartnersFallback ? '"Go-Eat Partner Support" <partners@ethereal.email>' : '"Go-Eat Partner Support" <partners@goeatng.com>',
        isFallback: this.isPartnersFallback
      };
    }
    if (channel === 'secure') {
      return {
        transporter: this.secureTransporter,
        from: this.isSecureFallback ? '"Go-Eat Security" <secure@ethereal.email>' : '"Go-Eat Security" <secure@goeatng.com>',
        isFallback: this.isSecureFallback
      };
    }
    return {
      transporter: this.defaultTransporter,
      from: this.isDefaultFallback ? '"Go-Eat Support" <info@ethereal.email>' : '"Go-Eat Support" <info@goeatng.com>',
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
    const htmlContent = this.getTemplateHtml('OTP_VERIFICATION', { otpCode: otp, validTime: '10 minutes' });
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
    const htmlContent = this.getTemplateHtml(template, data);
    await this.sendEmail(to, subject, htmlContent, senderType);
  }

  /**
   * Returns styled responsive layout depending on the template type
   */
  private getTemplateHtml(template: EmailTemplateType, data: Record<string, any>): string {
    const baseLayout = (content: string) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Go-Eat Notifications</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #FAFAFA; color: #111827; }
          .container { max-width: 600px; margin: 30px auto; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #F3F4F6; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background-color: #0F3725; padding: 30px 20px; text-align: center; }
          .logo { height: 40px; }
          .content { padding: 40px 30px; line-height: 1.6; }
          .footer { background-color: #FAFAFA; padding: 20px; text-align: center; font-size: 11px; color: #9CA3AF; border-t: 1px solid #F3F4F6; }
          .btn { display: inline-block; background-color: #0F3725; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: bold; font-size: 13px; margin: 20px 0; }
          .highlight-box { background-color: #F9FAFB; border-left: 4px solid #0F3725; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="color: #FFFFFF; margin: 0; font-weight: 900; letter-spacing: -0.025em;">GO-EAT</h2>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Go-Eat Platform. All rights reserved.</p>
            <p>You received this email because you are registered on the Go-Eat admin portal.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    switch (template) {
      case 'WELCOME_PARTNER':
        return baseLayout(`
          <h2 style="color: #0F3725; margin-top: 0; font-weight: 800;">Welcome to Go-Eat Partners!</h2>
          <p>Dear <strong>${data.partnerName || 'Outlet Partner'}</strong>,</p>
          <p>Congratulations! Your business, <strong>${data.restaurantName || 'Gourmet Outlet'}</strong>, is officially onboarded and activated on the Go-Eat Platform.</p>
          <p>You can now manage your menus, orders, payouts, and customer reviews through your partner dashboard.</p>
          <p>Below are your vendor portal credentials:</p>
          <div class="highlight-box">
            <p style="margin: 4px 0;"><strong>Dashboard Link:</strong> <a href="${data.loginUrl || 'https://partner.goeat.com'}" style="color: #0F3725;">Partner Portal</a></p>
            <p style="margin: 4px 0;"><strong>Username / Email:</strong> ${data.email}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> ${data.password}</p>
          </div>
          <p style="color: #4B5563;">For security reasons, we strongly recommend logging in and changing your password immediately.</p>
          <div style="text-align: center;">
            <a href="${data.loginUrl || 'https://partner.goeat.com'}" class="btn">Access Partner Dashboard</a>
          </div>
        `);

      case 'OTP_VERIFICATION':
        return baseLayout(`
          <h2 style="color: #0F3725; margin-top: 0; font-weight: 800;">Email Verification OTP</h2>
          <p>Hello,</p>
          <p>Please use the following 6-digit One-Time Password (OTP) to complete your account or email address verification. This code is valid for <strong>${data.validTime || '10 minutes'}</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #0F3725; background-color: #F3F4F6; padding: 12px 30px; border-radius: 12px; border: 1px solid #E5E7EB; font-family: monospace;">${data.otpCode}</span>
          </div>
          <p style="color: #EF4444; font-weight: bold;">Do not share this code with anyone. Go-Eat support staff will never ask for your OTP.</p>
        `);

      case 'CREDENTIALS_ALERT':
        return baseLayout(`
          <h2 style="color: #0F3725; margin-top: 0; font-weight: 800;">Your Go-Eat Administrator Account</h2>
          <p>Dear <strong>${data.name}</strong>,</p>
          <p>An administrative account has been created for you on the Go-Eat Platform by the Super Administrator.</p>
          <p>Here are your platform credentials:</p>
          <div class="highlight-box">
            <p style="margin: 4px 0;"><strong>System Access Role:</strong> ${data.role}</p>
            ${data.customRole ? `<p style="margin: 4px 0;"><strong>Permissions Scope:</strong> ${data.customRole.toUpperCase()}</p>` : ''}
            <p style="margin: 4px 0;"><strong>Username / Email:</strong> ${data.email}</p>
            <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${data.password}</p>
          </div>
          <p style="color: #4B5563;">Please use these details to log in to the admin panel and change your password to secure your account.</p>
        `);

      case 'ORDER_CONFIRMED':
        return baseLayout(`
          <h2 style="color: #0F3725; margin-top: 0; font-weight: 800;">Order Confirmed</h2>
          <p>Dear <strong>${data.customerName}</strong>,</p>
          <p>Your order <strong>#${data.orderId}</strong> has been received and confirmed by the outlet.</p>
          <p>Summary of order details:</p>
          <div class="highlight-box">
            <p style="margin: 4px 0;"><strong>Total Amount:</strong> ₦${data.totalAmount}</p>
            <p style="margin: 4px 0;"><strong>Delivery Address:</strong> ${data.deliveryAddress || 'Self Pickup'}</p>
          </div>
          <p style="color: #4B5563;">You will receive another update as soon as the rider accepts the delivery dispatch request.</p>
        `);

      case 'PASSWORD_RESET':
        return baseLayout(`
          <h2 style="color: #0F3725; margin-top: 0; font-weight: 800;">Reset Your Password</h2>
          <p>Dear <strong>${data.name}</strong>,</p>
          <p>You requested to reset your password for your Go-Eat account. Click the button below to set a new password. This link is valid for 1 hour.</p>
          <div style="text-align: center;">
            <a href="${data.resetUrl}" class="btn">Reset Password</a>
          </div>
          <p style="color: #9CA3AF; font-size: 11px; margin-top: 20px;">If you did not request this, you can safely ignore this email.</p>
        `);

      default:
        return baseLayout(`<p>${data.message || 'Notification alert from Go-Eat.'}</p>`);
    }
  }
}

export default new EmailService();
