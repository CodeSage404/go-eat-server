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
   * Creates an SMTP transporter for a specific port
   */
  private createTransporter(user: string, port: number): nodemailer.Transporter {
    const host = process.env.EMAIL_HOST || 'server390.web-hosting.com';
    const password = process.env.EMAIL_PASS;

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465 SSL, false for 587/2525 STARTTLS
      requireTLS: port === 587 || port === 2525,
      auth: {
        user,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 6000,
    } as any);
  }

  /**
   * Sends an email by trying multiple standard SMTP ports (587, 465, 2525)
   * to bypass cloud host firewall blocks on Render.
   */
  public async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    senderType: EmailSenderChannel = 'default'
  ): Promise<void> {
    const { user, from } = this.getSenderInfo(senderType);

    const defaultPort = Number(process.env.EMAIL_PORT) || 587;
    // Ports to attempt sequentially to overcome cloud provider port blocking
    const portsToTry = Array.from(new Set([defaultPort, 587, 465, 2525]));

    const mailOptions = {
      from,
      to,
      subject,
      html,
    };

    let sent = false;

    for (const port of portsToTry) {
      if (sent) break;

      try {
        const transporter = this.createTransporter(user, port);
        const info = await transporter.sendMail(mailOptions);
        logger.info(`📩 Email dispatched successfully to ${to} via ${from} on Port ${port} (MessageID: ${info.messageId})`);
        sent = true;
      } catch (err: any) {
        logger.warn(`⚠️ SMTP Port ${port} failed for ${from}: ${err.message}. Trying next port...`);
      }
    }

    if (!sent) {
      logger.error(`❌ All SMTP ports (${portsToTry.join(', ')}) failed for ${to} on host ${process.env.EMAIL_HOST || 'server390.web-hosting.com'}. Render cloud firewall is blocking outbound cPanel SMTP ports. Consider using Brevo/Resend API or setting EMAIL_PORT=587 in Render environment variables.`);
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
