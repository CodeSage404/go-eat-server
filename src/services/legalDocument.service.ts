import mongoose from 'mongoose';
import LegalDocument, {
  ILegalDocument,
  LegalDocumentType,
  LegalTargetRole,
  LegalCountryCode,
} from '../models/legalDocument.model';
import LegalAcceptance, { ILegalAcceptance } from '../models/legalAcceptance.model';
import UserNotification, { NotificationType } from '../models/userNotification.model';
import emailService from './email.service';
import logger from '../utils/logger';

export interface CreateLegalDocumentDto {
  documentType: LegalDocumentType;
  targetRole: LegalTargetRole;
  country: LegalCountryCode;
  title: string;
  content: string;
  version?: string;
  summaryOfChanges?: string;
  effectiveDate?: Date;
  isPublished?: boolean;
}

export class LegalDocumentService {
  /**
   * Upsert / Publish a legal document for a specific country and role.
   * If a document of the same type, targetRole, and country exists, it updates it and increments the version.
   */
  public static async publishDocument(
    data: CreateLegalDocumentDto,
    adminUserId?: string
  ): Promise<ILegalDocument> {
    const existing = await LegalDocument.findOne({
      documentType: data.documentType,
      targetRole: data.targetRole,
      country: data.country,
    });

    let nextVersion = data.version;
    if (!nextVersion) {
      if (existing?.version) {
        const parts = existing.version.split('.');
        const minor = parseInt(parts[1] || '0', 10) + 1;
        nextVersion = `${parts[0] || '1'}.${minor}`;
      } else {
        nextVersion = '1.0';
      }
    }

    if (existing) {
      existing.title = data.title;
      existing.content = data.content;
      existing.version = nextVersion;
      existing.summaryOfChanges = data.summaryOfChanges || `Updated to version ${nextVersion}`;
      existing.effectiveDate = data.effectiveDate || new Date();
      existing.isPublished = data.isPublished !== undefined ? data.isPublished : true;
      existing.publishedAt = new Date();
      if (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) {
        existing.updatedBy = new mongoose.Types.ObjectId(adminUserId);
      }
      await existing.save();
      logger.info(`[LEGAL] Updated ${data.documentType} (${data.country}/${data.targetRole}) to v${nextVersion}`);
      return existing;
    }

    const created = await LegalDocument.create({
      documentType: data.documentType,
      targetRole: data.targetRole,
      country: data.country,
      title: data.title,
      content: data.content,
      version: nextVersion,
      summaryOfChanges: data.summaryOfChanges || 'Initial published version',
      effectiveDate: data.effectiveDate || new Date(),
      isPublished: data.isPublished !== undefined ? data.isPublished : true,
      publishedAt: new Date(),
      updatedBy: adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)
        ? new mongoose.Types.ObjectId(adminUserId)
        : undefined,
    });

    logger.info(`[LEGAL] Created ${data.documentType} (${data.country}/${data.targetRole}) v${nextVersion}`);
    return created;
  }

  /**
   * Get an active published legal document matching the query,
   * with fallback to 'ALL' if country-specific version doesn't exist yet.
   */
  public static async getActiveDocument(
    documentType: LegalDocumentType,
    country: string = 'NG',
    targetRole: string = 'users'
  ): Promise<ILegalDocument | null> {
    const normCountry = (country || 'NG').toUpperCase() as LegalCountryCode;
    const normRole = (targetRole || 'users').toLowerCase() as LegalTargetRole;

    // 1. Exact match (e.g. documentType + UK + partners)
    let doc = await LegalDocument.findOne({
      documentType,
      country: normCountry,
      targetRole: normRole,
      isPublished: true,
    });

    // 2. Role match with country = ALL
    if (!doc && normCountry !== 'ALL') {
      doc = await LegalDocument.findOne({
        documentType,
        country: 'ALL',
        targetRole: normRole,
        isPublished: true,
      });
    }

    // 3. TargetRole = 'all' with exact country
    if (!doc) {
      doc = await LegalDocument.findOne({
        documentType,
        country: normCountry,
        targetRole: 'all',
        isPublished: true,
      });
    }

    // 4. Global fallback (country = 'ALL', targetRole = 'all')
    if (!doc) {
      doc = await LegalDocument.findOne({
        documentType,
        country: 'ALL',
        targetRole: 'all',
        isPublished: true,
      });
    }

    return doc;
  }

  /**
   * List all legal documents with admin filters
   */
  public static async listDocuments(filters: {
    country?: string;
    targetRole?: string;
    documentType?: string;
  } = {}): Promise<ILegalDocument[]> {
    const query: any = {};
    if (filters.country) query.country = filters.country.toUpperCase();
    if (filters.targetRole) query.targetRole = filters.targetRole.toLowerCase();
    if (filters.documentType) query.documentType = filters.documentType;

    return LegalDocument.find(query).sort({ updatedAt: -1 });
  }

  /**
   * Check if an authenticated user has pending legal terms that must be accepted
   * (e.g. on first transaction or if 6 months have elapsed).
   */
  public static async getPendingAcceptancesForUser(user: {
    _id: string;
    country?: string;
    countryCode?: string;
    role?: string;
  }): Promise<ILegalDocument[]> {
    const country = (user.countryCode || user.country || 'NG').toUpperCase() as LegalCountryCode;
    const role: LegalTargetRole =
      user.role === 'rider' ? 'riders' : user.role === 'vendor' || user.role === 'partner' ? 'partners' : 'users';

    // Find all published documents applicable to this user
    const mandatoryDocs = await LegalDocument.find({
      isPublished: true,
      $or: [
        { country, targetRole: role },
        { country, targetRole: 'all' },
        { country: 'ALL', targetRole: role },
        { country: 'ALL', targetRole: 'all' },
      ],
    });

    const pendingDocs: ILegalDocument[] = [];
    const now = new Date();

    for (const doc of mandatoryDocs) {
      // Find latest acceptance of this document type
      const latestAcceptance = await LegalAcceptance.findOne({
        userId: user._id,
        documentType: doc.documentType,
      }).sort({ acceptedAt: -1 });

      if (!latestAcceptance) {
        // Never accepted before
        pendingDocs.push(doc);
      } else if (latestAcceptance.documentVersion !== doc.version) {
        // A newer version was published by admin!
        pendingDocs.push(doc);
      } else if (latestAcceptance.repeatDueAt && latestAcceptance.repeatDueAt <= now) {
        // 6 months have elapsed since last acceptance
        pendingDocs.push(doc);
      }
    }

    return pendingDocs;
  }

  /**
   * Record a user's acceptance of an updated legal document.
   * Sends confirmation email & in-app notification and saves an audit log entry.
   */
  public static async recordAcceptance(data: {
    userId: string;
    userName: string;
    userEmail: string;
    userRole: 'user' | 'rider' | 'partner' | 'vendor' | 'admin';
    country: LegalCountryCode;
    documentType: LegalDocumentType;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ILegalAcceptance> {
    const activeDoc = await this.getActiveDocument(data.documentType, data.country, data.userRole === 'user' ? 'users' : data.userRole);
    if (!activeDoc) {
      throw new Error(`Active document for ${data.documentType} not found.`);
    }

    // 6-month repeat threshold
    const repeatDueAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    const acceptance = await LegalAcceptance.create({
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      userRole: data.userRole,
      country: data.country,
      documentType: data.documentType,
      documentId: activeDoc._id,
      documentVersion: activeDoc.version,
      documentTitle: activeDoc.title,
      acceptedAt: new Date(),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      repeatDueAt,
      notificationSent: false,
      emailSent: false,
    });

    // 1. Send in-app notification
    try {
      await UserNotification.create({
        user: data.userId,
        title: 'Updated Policy Accepted',
        body: `You have successfully reviewed and accepted our updated ${activeDoc.title} (v${activeDoc.version}).`,
        type: NotificationType.SYSTEM,
        isRead: false,
      });
      acceptance.notificationSent = true;
    } catch (err: any) {
      logger.warn(`Failed to create policy in-app notification: ${err.message}`);
    }

    // 2. Send confirmation email
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
          <h2 style="color: #0F3D26; margin-bottom: 16px;">GoEatOne Legal Notice Confirmation</h2>
          <p>Hello <strong>${data.userName}</strong>,</p>
          <p>This email confirms that you have reviewed and accepted the updated <strong>${activeDoc.title} (v${activeDoc.version})</strong> for GoEatOne.</p>
          <div style="background-color: #F4F7F5; border-left: 4px solid #10B981; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 6px 0;"><strong>Document:</strong> ${activeDoc.title}</p>
            <p style="margin: 0 0 6px 0;"><strong>Version:</strong> ${activeDoc.version}</p>
            <p style="margin: 0 0 6px 0;"><strong>Region / Market:</strong> ${data.country}</p>
            <p style="margin: 0;"><strong>Date & Time Accepted:</strong> ${new Date().toUTCString()}</p>
          </div>
          <p>Your acceptance has been logged in our secure compliance audit register. You can review the full active terms anytime on our website or mobile apps.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="font-size: 12px; color: #6B7280;">GoEatOne Compliance & Legal Operations • Global Food & Essentials Network</p>
        </div>
      `;

      await emailService.sendEmail(
        data.userEmail,
        `Confirmation: You accepted the updated ${activeDoc.title}`,
        emailHtml,
        'default'
      );
      acceptance.emailSent = true;
    } catch (err: any) {
      logger.warn(`Failed to send terms confirmation email to ${data.userEmail}: ${err.message}`);
    }

    await acceptance.save();
    return acceptance;
  }

  /**
   * Get compliance audit logs for admin
   */
  public static async getAcceptancesAuditLog(params: {
    country?: string;
    userRole?: string;
    documentType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (params.country && params.country !== 'ALL') {
      query.country = params.country.toUpperCase();
    }
    if (params.userRole && params.userRole !== 'all') {
      query.userRole = params.userRole.toLowerCase();
    }
    if (params.documentType && params.documentType !== 'all') {
      query.documentType = params.documentType;
    }
    if (params.search) {
      const regex = new RegExp(params.search.trim(), 'i');
      query.$or = [{ userName: regex }, { userEmail: regex }, { documentTitle: regex }];
    }

    const [total, acceptances] = await Promise.all([
      LegalAcceptance.countDocuments(query),
      LegalAcceptance.find(query).sort({ acceptedAt: -1 }).skip(skip).limit(limit),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      acceptances,
    };
  }
}
