import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { renderTemplate } from '../utils/templateEngine';

export type EmailSenderChannel = 'default' | 'partners' | 'secure';

export type EmailTemplateType = 
  | 'WELCOME_PARTNER' 
  | 'SUBSCRIPTION_CONFIRMATION'
  | 'OTP_VERIFICATION' 
  | 'CREDENTIALS_ALERT' 
  | 'ORDER_CONFIRMED' 
  | 'ORDER_ACCEPTED'
  | 'VENDOR_ORDER_RECEIVED'
  | 'ORDER_PREPARING'
  | 'ORDER_PICKED_UP'
  | 'ORDER_ON_THE_WAY'
  | 'PASSWORD_RESET'
  | 'WELCOME_USER'
  | 'NEW_DEVICE_LOGIN'
  | 'INACTIVITY_REENGAGEMENT'
  | 'RIDER_APPLICATION_RECEIVED'
  | 'RIDER_APPLICATION_APPROVED'
  | 'RIDER_ACTION_REQUIRED'
  | 'PARTNER_APPLICATION_RECEIVED'
  | 'WITHDRAWAL_RECEIPT'
  | 'PIN_RESET_ALERT'
  | 'BANK_UPDATE_ALERT'
  | 'ADMIN_PARTNER_SUBMISSION_ALERT'
  | 'ADMIN_RIDER_SUBMISSION_ALERT';

class EmailService {
  /**
   * Helper to fetch the correct user & sender header based on channel.
   * Strictly uses Brevo's verified senders list (business@goeatone.com and verify@goeatone.com)
   * to guarantee emails are never rejected.
   */
  private getSenderInfo(channel: EmailSenderChannel): { user: string; from: string } {
    const businessUser = 'business@goeatone.com';
    const secureUser = 'verify@goeatone.com';

    if (channel === 'secure') {
      return { user: secureUser, from: `"GoEatOne Security" <${secureUser}>` };
    }
    if (channel === 'partners') {
      return { user: businessUser, from: `"GoEatOne Business" <${businessUser}>` };
    }
    return { user: businessUser, from: `"GoEatOne Support" <${businessUser}>` };
  }

  /**
   * Resolves the directory where local email template assets (logos, badges) are stored.
   */
  private getAssetsDir(): string {
    const primary = path.join(__dirname, '../templates/assets');
    if (fs.existsSync(primary)) return primary;
    const fallback = path.join(__dirname, '../../src/templates/assets');
    if (fs.existsSync(fallback)) return fallback;
    return primary;
  }

  /**
   * Collects all local image assets as CID attachments for SMTP dispatch.
   */
  private getCidAttachments(): Array<{ filename: string; path: string; cid: string }> {
    const assetsDir = this.getAssetsDir();
    const attachments: Array<{ filename: string; path: string; cid: string }> = [];

    if (fs.existsSync(assetsDir)) {
      try {
        const files = fs.readdirSync(assetsDir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(ext)) {
            const nameWithoutExt = path.basename(file, ext);
            attachments.push({
              filename: file,
              path: path.join(assetsDir, file),
              cid: `goeat_${nameWithoutExt}`,
            });
          }
        }
      } catch (err: any) {
        logger.warn(`⚠️ Failed reading email assets directory for CID attachments: ${err.message}`);
      }
    }

    return attachments;
  }

  /**
   * Prepares HTML for HTTP-based email APIs (Brevo / Resend).
   * Since transactional HTTP APIs do not natively support CID attachments,
   * any 'cid:goeat_<asset>' references are resolved to the server's public '/email-assets' URL.
   */
  private prepareHtmlForHttpApi(html: string): string {
    const cloudCdnBase = 'https://res.cloudinary.com/dqtjja88b/image/upload/v1793280551/go_eat_email';
    const assetsDir = this.getAssetsDir();

    return html.replace(/cid:goeat_([a-zA-Z0-9_-]+)/g, (_match, assetName) => {
      const exts = ['.jpg', '.png', '.jpeg', '.svg', '.webp'];
      for (const ext of exts) {
        if (fs.existsSync(path.join(assetsDir, `${assetName}${ext}`))) {
          return `${cloudCdnBase}/${assetName}${ext}`;
        }
      }
      return `${cloudCdnBase}/${assetName}.png`;
    });
  }

  /**
   * Dispatches email via Brevo HTTPS REST API (Port 443 - Never blocked by Render firewall)
   * Supports automatic sender fallback if Brevo rejects an unverified address.
   */
  private async sendViaBrevoHttp(
    to: string, 
    subject: string, 
    html: string, 
    preferredSenderEmail: string, 
    preferredSenderName: string, 
    apiKey: string
  ): Promise<boolean> {
    const resolvedHtml = this.prepareHtmlForHttpApi(html);

    // Strictly try verified Brevo senders in order
    const candidateSenders = Array.from(new Set([
      preferredSenderEmail.toLowerCase().trim() === 'verify@goeatone.com' ? 'verify@goeatone.com' : 'business@goeatone.com',
      'business@goeatone.com',
      'verify@goeatone.com',
    ].filter(Boolean)));

    for (const senderEmail of candidateSenders) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: preferredSenderName, email: senderEmail },
            to: [{ email: to.toLowerCase().trim() }],
            subject,
            htmlContent: resolvedHtml,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          logger.info(`⚡ Email dispatched via Brevo HTTPS API from <${senderEmail}> to ${to} (MessageID: ${data.messageId || 'ok'})`);
          return true;
        } else {
          const errorText = await response.text();
          logger.warn(`⚠️ Brevo HTTPS API attempt with sender <${senderEmail}> failed (${response.status}): ${errorText}`);
          if (response.status === 401 || response.status === 403) {
            return false;
          }
        }
      } catch (err: any) {
        logger.warn(`⚠️ Brevo HTTPS API network error with sender <${senderEmail}>: ${err.message}`);
      }
    }

    return false;
  }

  /**
   * Dispatches email via Resend HTTPS REST API (Port 443 - Never blocked by Render firewall)
   */
  private async sendViaResendHttp(to: string, subject: string, html: string, fromHeader: string, apiKey: string): Promise<boolean> {
    const resolvedHtml = this.prepareHtmlForHttpApi(html);
    const candidateFroms = Array.from(new Set([
      fromHeader,
      `"GoEatOne Business" <business@goeatone.com>`,
      `"GoEatOne Support" <support@goeatone.com>`,
    ].filter(Boolean)));

    for (const currentFrom of candidateFroms) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: currentFrom,
            to: [to.toLowerCase().trim()],
            subject,
            html: resolvedHtml,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          logger.info(`⚡ Email dispatched via Resend HTTPS API (${currentFrom}) to ${to} (MessageID: ${data.id || 'ok'})`);
          return true;
        } else {
          const errorText = await response.text();
          logger.warn(`⚠️ Resend HTTPS API attempt (${currentFrom}) failed (${response.status}): ${errorText}`);
          if (response.status === 401 || response.status === 403) {
            return false;
          }
        }
      } catch (err: any) {
        logger.warn(`⚠️ Resend HTTPS API error (${currentFrom}): ${err.message}`);
      }
    }

    return false;
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
    const senderName = senderType === 'partners' ? 'GoEatOne Partner Support' : senderType === 'secure' ? 'GoEatOne Security' : 'GoEatOne Support';

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
    const attachments = this.getCidAttachments();

    const mailOptions = {
      from,
      to,
      subject,
      html,
      attachments,
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
  public async sendOTP(email: string, otp: string, senderType: EmailSenderChannel = 'secure'): Promise<void> {
    const htmlContent = renderTemplate('OTP_VERIFICATION', { otpCode: otp, validTime: '10 minutes' });
    try {
      await this.sendEmail(email, 'Your GoEatOne Verification OTP Code', htmlContent, senderType);
    } catch (err: any) {
      logger.error(`OTP dispatch failed to ${email}:`, err?.message || err);
    }
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

  /**
   * Sends a security alert notification when a new device logs into an account
   */
  public async sendNewDeviceLoginAlert(
    email: string,
    data: {
      name: string;
      email: string;
      deviceName: string;
      ipAddress: string;
      timestamp: string;
      location?: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('NEW_DEVICE_LOGIN', data);
    this.sendEmail(email, 'Security Alert: New device login on your GoEatOne account', htmlContent, 'secure')
      .catch(err => logger.error(`Background new device alert email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends a 7-day inactivity re-engagement notification
   */
  public async sendInactivityReengagement(
    email: string,
    data: {
      name: string;
      actionUrl?: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('INACTIVITY_REENGAGEMENT', data);
    this.sendEmail(email, 'We miss you at GoEatOne - Craving something delicious?', htmlContent, 'default')
      .catch(err => logger.error(`Background inactivity email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends rotating bi-weekly promotional marketing campaign emails to customers
   */
  public async sendPromotionalEngagement(
    email: string,
    data: {
      name: string;
      headline: string;
      subheadline: string;
      badgeText?: string;
      introText?: string;
      highlightTitle?: string;
      highlightText?: string;
      buttonText?: string;
      actionUrl?: string;
    },
    subject: string
  ): Promise<void> {
    const htmlContent = renderTemplate('PROMOTIONAL_ENGAGEMENT', data);
    this.sendEmail(email, subject, htmlContent, 'default')
      .catch(err => logger.error(`Background promotional campaign email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends courier verification application received email
   */
  public async sendRiderApplicationReceived(
    email: string,
    data: {
      riderName: string;
      timeline?: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('RIDER_APPLICATION_RECEIVED', data);
    this.sendEmail(email, 'Your GoEatOne Courier Application Has Been Received (Under Review)', htmlContent, 'default')
      .catch(err => logger.error(`Background courier received email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends courier verification approval notification email
   */
  public async sendRiderApplicationApproved(
    email: string,
    data: {
      riderName: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('RIDER_APPLICATION_APPROVED', data);
    this.sendEmail(email, 'You are Approved to Deliver on GoEatOne', htmlContent, 'default')
      .catch(err => logger.error(`Background courier approved email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends courier verification correction required email
   */
  public async sendRiderActionRequired(
    email: string,
    data: {
      riderName: string;
      reason?: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('RIDER_ACTION_REQUIRED', data);
    this.sendEmail(email, 'Action Required: Your GoEatOne Courier Verification', htmlContent, 'default')
      .catch(err => logger.error(`Background courier correction email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends partner merchant application acknowledgement email to claim provisional business profile
   */
  public async sendPartnerApplicationReceived(
    email: string,
    data: {
      ownerName: string;
      businessName: string;
      businessType?: string;
      businessAddress: string;
      email: string;
      phoneNumber: string;
      claimCode?: string;
      claimUrl?: string;
      optOutUrl?: string;
      loginUrl?: string;
      country?: string;
    }
  ): Promise<void> {
    const webBaseUrl = process.env.CLIENT_URL || process.env.WEB_APP_URL || 'https://go-eat-webapp.vercel.app';
    const claimUrl = data.claimUrl || `${webBaseUrl}/partners/claim-profile?email=${encodeURIComponent(email)}&code=${encodeURIComponent(data.claimCode || '')}`;
    const optOutUrl = data.optOutUrl || `${webBaseUrl}/partners/opt-out?email=${encodeURIComponent(email)}`;

    const htmlContent = renderTemplate('PARTNER_APPLICATION_RECEIVED', {
      ...data,
      claimCode: data.claimCode || '',
      claimUrl,
      optOutUrl,
      loginUrl: data.loginUrl || `${webBaseUrl}/partners/login`,
    });
    try {
      await this.sendEmail(email, 'Claim Your Provisional Business Profile on GoEatOne', htmlContent, 'partners');
    } catch (err: any) {
      logger.error(`Partner application received email failed to ${email}:`, err?.message || err);
    }
  }

  /**
   * Sends Partner Application Declined / Action Required email when status is set to rejected
   */
  public async sendPartnerApplicationDeclined(
    email: string,
    data: {
      businessName: string;
      ownerName?: string;
      adminNotes?: string;
    }
  ): Promise<void> {
    try {
      const htmlContent = renderTemplate('PARTNER_APPLICATION_DECLINED', data);
      await this.sendEmail(
        email,
        `Update on your GoEatOne partner application for ${data.businessName}`,
        htmlContent,
        'partners'
      );
      logger.info(`📧 Partner application declined email dispatched to ${email}`);
    } catch (err: any) {
      logger.error(`Partner application declined email failed to ${email}:`, err?.message || err);
    }
  }

  /**
   * Sends Founding Partner Onboarding email when an admin onboards / approves a partner in admin dashboard
   */
  public async sendFoundingPartnerOnboarded(
    email: string,
    data: {
      partnerName?: string;
      ownerName?: string;
      businessName: string;
      restaurantName?: string;
      businessType?: string;
      outletType?: string;
      businessAddress?: string;
      address?: any;
      phoneNumber?: string;
      phone?: string;
      email: string;
      country?: string;
      isFoundingPartner?: boolean;
      loginUrl?: string;
      optOutUrl?: string;
    }
  ): Promise<void> {
    const webBaseUrl = process.env.CLIENT_URL || process.env.WEB_APP_URL || 'https://go-eat-webapp.vercel.app';
    const htmlContent = renderTemplate('WELCOME_PARTNER', {
      ...data,
      isFoundingPartner: data.isFoundingPartner !== false,
      loginUrl: data.loginUrl || `${webBaseUrl}/partners/login`,
      optOutUrl: data.optOutUrl || `${webBaseUrl}/partners/opt-out?email=${encodeURIComponent(email)}`,
    });
    try {
      await this.sendEmail(
        email,
        "We've given your business a head start — GoEatOne Founding Partner Onboarding",
        htmlContent,
        'partners'
      );
      logger.info(`📧 Founding partner onboarding email dispatched to ${email}`);
    } catch (err: any) {
      logger.error(`Founding partner onboarding email failed to ${email}:`, err?.message || err);
    }
  }

  /**
   * Sends subscription confirmation receipt email to partner
   */
  public async sendSubscriptionConfirmation(
    email: string,
    data: {
      partnerName: string;
      restaurantName: string;
      planTier: string;
      planName: string;
      amountFormatted: string;
      commission: string;
      reference?: string;
      renewalDate?: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('SUBSCRIPTION_CONFIRMATION', data);
    try {
      await this.sendEmail(
        email,
        `Your GoEatOne ${data.planName} Subscription is Active`,
        htmlContent,
        'partners'
      );
      logger.info(`📧 Subscription confirmation email dispatched to ${email}`);
    } catch (err: any) {
      logger.error(`Subscription confirmation email failed to ${email}:`, err?.message || err);
    }
  }

  /**
   * Sends advance notification of UK Bacs Direct Debit instruction submission to merchant
   */
  public async sendBacsMandateNotice(
    email: string,
    data: {
      partnerName: string;
      restaurantName: string;
      mandateReference: string;
      sortCode: string;
      accountNumberMasked: string;
      planName: string;
      amountFormatted: string;
    }
  ): Promise<void> {
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <div style="background-color: #0F3D26; padding: 24px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">GoEatOne UK Direct Debit Advance Notice</h1>
          <p style="color: #A7F3D0; font-size: 13px; margin-top: 6px;">Bacs Direct Debit Instruction Received</p>
        </div>
        <p style="font-size: 15px;">Hello <strong>${data.partnerName || 'Partner'}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6;">Thank you for setting up a Bacs Direct Debit instruction for <strong>${data.restaurantName}</strong> on GoEatOne. This email confirms that we have registered your Direct Debit details.</p>
        
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 14px; color: #0F3D26; text-transform: uppercase; letter-spacing: 0.5px;">Instruction Summary</h3>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6B7280;">Service User Name:</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">GoEatOne Global UK</td></tr>
            <tr><td style="padding: 6px 0; color: #6B7280;">Mandate Reference:</td><td style="padding: 6px 0; font-weight: 700; color: #0F3D26; text-align: right;">${data.mandateReference}</td></tr>
            <tr><td style="padding: 6px 0; color: #6B7280;">Account Sort Code:</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.sortCode}</td></tr>
            <tr><td style="padding: 6px 0; color: #6B7280;">Bank Account Number:</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.accountNumberMasked}</td></tr>
            <tr><td style="padding: 6px 0; color: #6B7280;">Subscription Plan:</td><td style="padding: 6px 0; font-weight: 600; text-align: right;">${data.planName} (${data.amountFormatted}/month)</td></tr>
          </table>
        </div>

        <div style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #92400E; font-weight: 700;">Account Verification in Progress</h4>
          <p style="margin: 0; font-size: 12px; color: #78350F; line-height: 1.5;">Our compliance verification team is currently verifying your business credentials. No funds will be debited until your account details have been formally verified. You will receive an immediate notification as soon as verification completes.</p>
        </div>

        <div style="border-top: 2px solid #E5E7EB; padding-top: 16px; margin-top: 24px;">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #111827; font-weight: 700;">The Direct Debit Guarantee</h4>
          <ul style="font-size: 11px; color: #6B7280; line-height: 1.5; padding-left: 18px; margin: 0;">
            <li>This Guarantee is offered by all banks and building societies that accept instructions to pay Direct Debits.</li>
            <li>If there are any changes to the amount, date or frequency of your Direct Debit GoEatOne will notify you 3 working days in advance of your account being debited or as otherwise agreed.</li>
            <li>If an error is made in the payment of your Direct Debit, by GoEatOne or your bank or building society, you are entitled to a full and immediate refund of the amount paid from your bank or building society.</li>
            <li>You can cancel a Direct Debit at any time by simply contacting your bank or building society. Written confirmation may be required. Please also notify us.</li>
          </ul>
        </div>
        
        <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 24px;">© 2026 GoEatOne Global · 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom</p>
      </div>
    `;

    try {
      await this.sendEmail(
        email,
        `UK Direct Debit Instruction Registered: Ref ${data.mandateReference}`,
        htmlContent,
        'partners'
      );
      logger.info(`📧 Bacs mandate notice email dispatched to ${email}`);
    } catch (err: any) {
      logger.error(`Bacs mandate notice email failed to ${email}:`, err?.message || err);
    }
  }

  /**
   * Sends confirmation that the UK Bacs Direct Debit mandate has been verified and approved by admin
   */
  public async sendBacsMandateApproved(
    email: string,
    data: {
      partnerName: string;
      restaurantName: string;
      mandateReference: string;
      planName: string;
      monthlyFee: string;
      nextDebitDate: string;
    }
  ): Promise<void> {
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <div style="background-color: #0F3D26; padding: 24px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">Direct Debit Mandate Verified & Approved</h1>
          <p style="color: #A7F3D0; font-size: 13px; margin-top: 6px;">GoEatOne UK Partner Account Active</p>
        </div>
        <p style="font-size: 15px;">Hello <strong>${data.partnerName || 'Partner'}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6;">Great news! Your Bacs Direct Debit instruction for <strong>${data.restaurantName}</strong> has been successfully reviewed and approved by our compliance team.</p>
        
        <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <h3 style="margin-top: 0; font-size: 14px; color: #065F46; text-transform: uppercase;">Active Mandate Details</h3>
          <p style="font-size: 13px; margin: 4px 0; color: #065F46;"><strong>Mandate Reference:</strong> ${data.mandateReference}</p>
          <p style="font-size: 13px; margin: 4px 0; color: #065F46;"><strong>Plan Tier:</strong> ${data.planName}</p>
          <p style="font-size: 13px; margin: 4px 0; color: #065F46;"><strong>Monthly Amount:</strong> ${data.monthlyFee}</p>
          <p style="font-size: 13px; margin: 4px 0; color: #065F46;"><strong>First Debit Cycle:</strong> ${data.nextDebitDate}</p>
        </div>

        <p style="font-size: 14px; line-height: 1.5;">Your merchant dashboard features are now completely unlocked and active.</p>

        <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 24px;">© 2026 GoEatOne Global · 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom</p>
      </div>
    `;

    try {
      await this.sendEmail(
        email,
        `Direct Debit Verified & Active: Ref ${data.mandateReference}`,
        htmlContent,
        'partners'
      );
      logger.info(`📧 Bacs mandate approved email dispatched to ${email}`);
    } catch (err: any) {
      logger.error(`Bacs mandate approved email failed to ${email}:`, err?.message || err);
    }
  }

  /**
   * Sends admin operational notification when a new partner registers and submits documents for review
   */
  public async sendAdminPartnerSubmissionAlert(data: {
    businessName: string;
    ownerName?: string;
    email: string;
    phoneNumber: string;
    businessAddress?: string;
    businessType?: string;
    country?: string;
    documentsList?: string;
    applicationId?: string;
    submittedAt?: string;
  }): Promise<void> {
    const adminEmail = (process.env.ADMIN_ALERT_EMAIL || 'support@goeatone.com').toLowerCase().trim();
    const adminPortalUrl = (process.env.ADMIN_PORTAL_URL || 'https://admin.goeatone.com').replace(/\/$/, '');
    const reviewUrl = `${adminPortalUrl}/dashboard/applications`;

    const templateData = {
      ...data,
      reviewUrl,
      submittedAt: data.submittedAt || new Date().toUTCString(),
    };

    try {
      const htmlContent = renderTemplate('ADMIN_PARTNER_SUBMISSION_ALERT', templateData);
      this.sendEmail(
        adminEmail,
        `Action Required: New Partner Application Submitted - ${data.businessName} (Awaiting Admin Review)`,
        htmlContent,
        'default'
      ).catch(err => logger.error(`Background admin partner submission alert failed to ${adminEmail}:`, err?.message || err));
    } catch (templateErr: any) {
      logger.error(`Failed to compile admin partner submission template: ${templateErr.message}`);
    }
  }

  /**
   * Sends admin operational notification when a courier submits onboarding / verification documents for review
   */
  public async sendAdminRiderSubmissionAlert(data: {
    riderName: string;
    email?: string;
    phoneNumber?: string;
    deliveryMethod?: string;
    vehicleReg?: string;
    country?: string;
    documentsList?: string;
    riderId?: string;
    submittedAt?: string;
  }): Promise<void> {
    const adminEmail = (process.env.ADMIN_ALERT_EMAIL || 'support@goeatone.com').toLowerCase().trim();
    const adminPortalUrl = (process.env.ADMIN_PORTAL_URL || 'https://admin.goeatone.com').replace(/\/$/, '');
    const reviewUrl = `${adminPortalUrl}/management/riders`;

    const templateData = {
      ...data,
      email: data.email || 'Not provided',
      phoneNumber: data.phoneNumber || 'Not provided',
      deliveryMethod: data.deliveryMethod || 'Motorcycle',
      reviewUrl,
      submittedAt: data.submittedAt || new Date().toUTCString(),
    };

    try {
      const htmlContent = renderTemplate('ADMIN_RIDER_SUBMISSION_ALERT', templateData);
      this.sendEmail(
        adminEmail,
        `Action Required: Courier Verification Documents Submitted - ${data.riderName} (Awaiting Admin Review)`,
        htmlContent,
        'default'
      ).catch(err => logger.error(`Background admin rider submission alert failed to ${adminEmail}:`, err?.message || err));
    } catch (templateErr: any) {
      logger.error(`Failed to compile admin rider submission template: ${templateErr.message}`);
    }
  }

  /**
   * Sends a withdrawal payout receipt email
   */
  public async sendWithdrawalReceipt(
    email: string,
    data: {
      userName: string;
      reference: string;
      date: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      status: string;
      currencySymbol: string;
      amount: number;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('WITHDRAWAL_RECEIPT', data);
    this.sendEmail(email, `Receipt for your withdrawal payout #${data.reference}`, htmlContent, 'default')
      .catch(err => logger.error(`Background withdrawal receipt email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends a GoEatOne Buddy invitation email
   */
  public async sendBuddyInvitation(
    to: string,
    data: {
      buddyName: string;
      userName: string;
      acceptUrl: string;
      declineUrl: string;
    }
  ): Promise<void> {
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB;">
        <div style="background-color: #004320; padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">GoEatOne</h1>
          <p style="color: #A7F3D0; margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">Responsible Purchasing Safeguard</p>
        </div>
        <div style="padding: 32px 24px; color: #1F2937;">
          <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">Hello ${data.buddyName},</h2>
          <p style="font-size: 15px; line-height: 24px; color: #4B5563; margin-bottom: 20px;">
            <strong>${data.userName}</strong> has invited you to be their <strong>GoEatOne Buddy</strong> on GoEatOne.
          </p>
          <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; line-height: 22px; color: #166534;">
              <strong>What does a GoEatOne Buddy do?</strong><br/>
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
          <p style="margin: 0; font-size: 12px; color: #6B7280;">© ${new Date().getFullYear()} GoEatOne. All rights reserved.</p>
        </div>
      </div>
    `;
    this.sendEmail(to, `${data.userName} invited you to be their GoEatOne Buddy`, htmlContent, 'default')
      .catch(err => logger.error(`Background buddy invitation email failed to ${to}:`, err?.message || err));
  }

  /**
   * Sends a security alert notification when transaction PIN is reset
   */
  public async sendPinResetSecurityAlert(
    email: string,
    data: {
      name: string;
      email: string;
      timestamp: string;
      cooldownUntil: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('PIN_RESET_ALERT', data);
    this.sendEmail(email, 'Security Alert: Your GoEat Transaction PIN Was Reset (24h Cooldown Active)', htmlContent, 'secure')
      .catch(err => logger.error(`Background PIN reset alert email failed to ${email}:`, err?.message || err));
  }

  /**
   * Sends a security alert notification when settlement bank details are modified
   */
  public async sendBankUpdateSecurityAlert(
    email: string,
    data: {
      name: string;
      email: string;
      bankName: string;
      accountNumberMasked: string;
      timestamp: string;
      cooldownUntil: string;
    }
  ): Promise<void> {
    const htmlContent = renderTemplate('BANK_UPDATE_ALERT', data);
    this.sendEmail(email, 'Security Alert: Settlement Bank Changed on GoEat (24h Cooldown Active)', htmlContent, 'secure')
      .catch(err => logger.error(`Background bank update alert email failed to ${email}:`, err?.message || err));
  }
}

export default new EmailService();
