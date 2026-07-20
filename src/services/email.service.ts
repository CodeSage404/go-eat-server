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
   * Helper to fetch the correct user & sender header based on channel.
   * Ensures all email addresses are lowercase to strictly match Brevo's verified senders list.
   */
  private getSenderInfo(channel: EmailSenderChannel): { user: string; from: string } {
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
  private async sendViaBrevoHttp(to: string, subject: string, html: string, senderEmail: string, senderName: string, apiKey: string): Promise<boolean> {
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
        const data = await response.json() as any;
        logger.info(`⚡ Email dispatched via Brevo HTTPS API to ${to} (MessageID: ${data.messageId || 'ok'})`);
        return true;
      } else {
        const errorText = await response.text();
        logger.warn(`⚠️ Brevo HTTPS API dispatch failed (${response.status}): ${errorText}`);
        return false;
      }
    } catch (err: any) {
      logger.warn(`⚠️ Brevo HTTPS API request error: ${err.message}`);
      return false;
    }
  }

  /**
   * Dispatches email via Resend HTTPS REST API (Port 443 - Never blocked by Render firewall)
   */
  private async sendViaResendHttp(to: string, subject: string, html: string, fromHeader: string, apiKey: string): Promise<boolean> {
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
        const data = await response.json() as any;
        logger.info(`⚡ Email dispatched via Resend HTTPS API to ${to} (MessageID: ${data.id || 'ok'})`);
        return true;
      } else {
        const errorText = await response.text();
        logger.warn(`⚠️ Resend HTTPS API dispatch failed (${response.status}): ${errorText}`);
        return false;
      }
    } catch (err: any) {
      logger.warn(`⚠️ Resend HTTPS API request error: ${err.message}`);
      return false;
    }
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
    } as any);
  }

  /**
   * Sends an email via HTTPS API (Brevo/Resend) first, or falls back to multi-port SMTP (587, 465, 2525)
   */
  public async sendEmail(
    to: string, 
    subject: string, 
    html: string, 
    senderType: EmailSenderChannel = 'default'
  ): Promise<void> {
    const { user: senderEmail, from } = this.getSenderInfo(senderType);
    const senderName = senderType === 'partners' ? 'Go-Eat Partner Support' : senderType === 'secure' ? 'Go-Eat Security' : 'Go-Eat Support';

    // 1. Try Brevo HTTPS API if key is present
    if (process.env.BREVO_API_KEY) {
      const ok = await this.sendViaBrevoHttp(to, subject, html, senderEmail, senderName, process.env.BREVO_API_KEY);
      if (ok) return;
    }

    // 2. Try Resend HTTPS API if key is present
    if (process.env.RESEND_API_KEY) {
      const ok = await this.sendViaResendHttp(to, subject, html, from, process.env.RESEND_API_KEY);
      if (ok) return;
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
      if (sent) break;

      try {
        const transporter = this.createTransporter(senderEmail, port);
        const info = await transporter.sendMail(mailOptions);
        logger.info(`📩 Email dispatched successfully to ${to} via ${from} on Port ${port} (MessageID: ${info.messageId})`);
        sent = true;
      } catch (err: any) {
        logger.warn(`⚠️ SMTP Port ${port} failed for ${from}: ${err.message}. Trying next port...`);
      }
    }

    if (!sent) {
      logger.error(`❌ All SMTP ports (${portsToTry.join(', ')}) failed for ${to} on host ${process.env.EMAIL_HOST || 'server390.web-hosting.com'}. Render cloud firewall blocks raw SMTP mail ports.`);
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
