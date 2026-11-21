"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalDocumentService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const legalDocument_model_1 = __importDefault(require("../models/legalDocument.model"));
const legalAcceptance_model_1 = __importDefault(require("../models/legalAcceptance.model"));
const userNotification_model_1 = __importStar(require("../models/userNotification.model"));
const email_service_1 = __importDefault(require("./email.service"));
const logger_1 = __importDefault(require("../utils/logger"));
class LegalDocumentService {
    /**
     * Upsert / Publish a legal document for a specific country and role.
     * If a document of the same type, targetRole, and country exists, it updates it and increments the version.
     */
    static async publishDocument(data, adminUserId) {
        const existing = await legalDocument_model_1.default.findOne({
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
            }
            else {
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
            if (adminUserId && mongoose_1.default.Types.ObjectId.isValid(adminUserId)) {
                existing.updatedBy = new mongoose_1.default.Types.ObjectId(adminUserId);
            }
            await existing.save();
            logger_1.default.info(`[LEGAL] Updated ${data.documentType} (${data.country}/${data.targetRole}) to v${nextVersion}`);
            return existing;
        }
        const created = await legalDocument_model_1.default.create({
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
            updatedBy: adminUserId && mongoose_1.default.Types.ObjectId.isValid(adminUserId)
                ? new mongoose_1.default.Types.ObjectId(adminUserId)
                : undefined,
        });
        logger_1.default.info(`[LEGAL] Created ${data.documentType} (${data.country}/${data.targetRole}) v${nextVersion}`);
        return created;
    }
    /**
     * Get an active published legal document matching the query,
     * with fallback to 'ALL' if country-specific version doesn't exist yet.
     */
    static async getActiveDocument(documentType, country = 'NG', targetRole = 'users') {
        const normCountry = (country || 'NG').toUpperCase();
        const normRole = (targetRole || 'users').toLowerCase();
        // 1. Exact match (e.g. documentType + UK + partners)
        let doc = await legalDocument_model_1.default.findOne({
            documentType,
            country: normCountry,
            targetRole: normRole,
            isPublished: true,
        });
        // 2. Role match with country = ALL
        if (!doc && normCountry !== 'ALL') {
            doc = await legalDocument_model_1.default.findOne({
                documentType,
                country: 'ALL',
                targetRole: normRole,
                isPublished: true,
            });
        }
        // 3. TargetRole = 'all' with exact country
        if (!doc) {
            doc = await legalDocument_model_1.default.findOne({
                documentType,
                country: normCountry,
                targetRole: 'all',
                isPublished: true,
            });
        }
        // 4. Global fallback (country = 'ALL', targetRole = 'all')
        if (!doc) {
            doc = await legalDocument_model_1.default.findOne({
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
    static async listDocuments(filters = {}) {
        const query = {};
        if (filters.country)
            query.country = filters.country.toUpperCase();
        if (filters.targetRole)
            query.targetRole = filters.targetRole.toLowerCase();
        if (filters.documentType)
            query.documentType = filters.documentType;
        return legalDocument_model_1.default.find(query).sort({ updatedAt: -1 });
    }
    /**
     * Check if an authenticated user has pending legal terms that must be accepted
     * (e.g. on first transaction or if 6 months have elapsed).
     */
    static async getPendingAcceptancesForUser(user) {
        const country = (user.countryCode || user.country || 'NG').toUpperCase();
        const role = user.role === 'rider' ? 'riders' : user.role === 'vendor' || user.role === 'partner' ? 'partners' : 'users';
        // Find all published documents applicable to this user
        const mandatoryDocs = await legalDocument_model_1.default.find({
            isPublished: true,
            $or: [
                { country, targetRole: role },
                { country, targetRole: 'all' },
                { country: 'ALL', targetRole: role },
                { country: 'ALL', targetRole: 'all' },
            ],
        });
        const pendingDocs = [];
        const now = new Date();
        for (const doc of mandatoryDocs) {
            // Find latest acceptance of this document type
            const latestAcceptance = await legalAcceptance_model_1.default.findOne({
                userId: user._id,
                documentType: doc.documentType,
            }).sort({ acceptedAt: -1 });
            if (!latestAcceptance) {
                // Never accepted before
                pendingDocs.push(doc);
            }
            else if (latestAcceptance.documentVersion !== doc.version) {
                // A newer version was published by admin!
                pendingDocs.push(doc);
            }
            else if (latestAcceptance.repeatDueAt && latestAcceptance.repeatDueAt <= now) {
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
    static async recordAcceptance(data) {
        const activeDoc = await this.getActiveDocument(data.documentType, data.country, data.userRole === 'user' ? 'users' : data.userRole);
        if (!activeDoc) {
            throw new Error(`Active document for ${data.documentType} not found.`);
        }
        // 6-month repeat threshold
        const repeatDueAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        const acceptance = await legalAcceptance_model_1.default.create({
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
            await userNotification_model_1.default.create({
                user: data.userId,
                title: 'Updated Policy Accepted',
                body: `You have successfully reviewed and accepted our updated ${activeDoc.title} (v${activeDoc.version}).`,
                type: userNotification_model_1.NotificationType.SYSTEM,
                isRead: false,
            });
            acceptance.notificationSent = true;
        }
        catch (err) {
            logger_1.default.warn(`Failed to create policy in-app notification: ${err.message}`);
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
            await email_service_1.default.sendEmail(data.userEmail, `Confirmation: You accepted the updated ${activeDoc.title}`, emailHtml, 'default');
            acceptance.emailSent = true;
        }
        catch (err) {
            logger_1.default.warn(`Failed to send terms confirmation email to ${data.userEmail}: ${err.message}`);
        }
        await acceptance.save();
        return acceptance;
    }
    /**
     * Get compliance audit logs for admin
     */
    static async getAcceptancesAuditLog(params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;
        const query = {};
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
            legalAcceptance_model_1.default.countDocuments(query),
            legalAcceptance_model_1.default.find(query).sort({ acceptedAt: -1 }).skip(skip).limit(limit),
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
exports.LegalDocumentService = LegalDocumentService;
