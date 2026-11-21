"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalDocumentController = void 0;
const legalDocument_service_1 = require("../services/legalDocument.service");
const auditLogger_1 = require("../utils/auditLogger");
class LegalDocumentController {
    /**
     * Admin publishes or updates a legal document
     */
    static async publishDocument(req, res) {
        try {
            const { documentType, targetRole, country, title, content, version, summaryOfChanges, effectiveDate, isPublished, } = req.body;
            if (!documentType || !title || !content) {
                return res.status(400).json({
                    status: 'error',
                    message: 'documentType, title, and content are required fields',
                });
            }
            const adminUserId = req.user?._id;
            const doc = await legalDocument_service_1.LegalDocumentService.publishDocument({
                documentType,
                targetRole: targetRole || 'all',
                country: (country || 'ALL').toUpperCase(),
                title,
                content,
                version,
                summaryOfChanges,
                effectiveDate,
                isPublished: isPublished !== undefined ? isPublished : true,
            }, adminUserId);
            (0, auditLogger_1.logPlatformActivity)({
                user: req.user?.name || req.user?.email || 'Admin',
                action: `Admin published legal policy: "${title || documentType}" for market ${country || 'ALL'} [v${version || '1.0'}]`,
                category: 'legal',
                ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
                status: 'success',
            });
            return res.status(200).json({
                status: 'success',
                message: 'Legal document published successfully',
                data: { document: doc },
            });
        }
        catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to publish legal document',
            });
        }
    }
    /**
     * Get single active document by type, country, and role (Public)
     */
    static async getDocument(req, res) {
        try {
            const { type } = req.params;
            const { country = 'NG', role = 'users' } = req.query;
            const doc = await legalDocument_service_1.LegalDocumentService.getActiveDocument(type, country, role);
            if (!doc) {
                return res.status(404).json({
                    status: 'fail',
                    message: `No active ${type} document found for country ${country}`,
                });
            }
            return res.status(200).json({
                status: 'success',
                data: { document: doc },
            });
        }
        catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to retrieve legal document',
            });
        }
    }
    /**
     * List all documents (Admin view)
     */
    static async listDocuments(req, res) {
        try {
            const { country, targetRole, documentType } = req.query;
            const docs = await legalDocument_service_1.LegalDocumentService.listDocuments({
                country: country,
                targetRole: targetRole,
                documentType: documentType,
            });
            return res.status(200).json({
                status: 'success',
                results: docs.length,
                data: { documents: docs },
            });
        }
        catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to list legal documents',
            });
        }
    }
    /**
     * Check pending acceptances for current authenticated user
     */
    static async getPendingAcceptances(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
            }
            const pending = await legalDocument_service_1.LegalDocumentService.getPendingAcceptancesForUser(user);
            return res.status(200).json({
                status: 'success',
                data: {
                    hasPendingAcceptances: pending.length > 0,
                    pendingDocuments: pending,
                },
            });
        }
        catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to check pending acceptances',
            });
        }
    }
    /**
     * User/Rider/Partner records acceptance of updated terms
     */
    static async acceptDocument(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
            }
            const { documentType, country } = req.body;
            if (!documentType) {
                return res.status(400).json({
                    status: 'error',
                    message: 'documentType is required',
                });
            }
            const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const userCountry = (country || user.countryCode || user.country || 'NG').toUpperCase();
            const acceptance = await legalDocument_service_1.LegalDocumentService.recordAcceptance({
                userId: user._id.toString(),
                userName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
                userEmail: user.email,
                userRole: user.role || 'user',
                country: userCountry,
                documentType,
                ipAddress,
                userAgent,
            });
            (0, auditLogger_1.logPlatformActivity)({
                user: user.name || user.email || user.phoneNumber || 'User',
                action: `User accepted compliance policy: ${documentType} for market ${userCountry}`,
                category: 'legal',
                ipAddress: ipAddress || '127.0.0.1',
                status: 'success',
            });
            return res.status(200).json({
                status: 'success',
                message: 'Terms acceptance logged and confirmation dispatched',
                data: { acceptance },
            });
        }
        catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to log terms acceptance',
            });
        }
    }
    /**
     * Admin view of accepted terms audit register
     */
    static async getAcceptancesAuditLog(req, res) {
        try {
            const { country, userRole, documentType, search, page, limit } = req.query;
            const result = await legalDocument_service_1.LegalDocumentService.getAcceptancesAuditLog({
                country: country,
                userRole: userRole,
                documentType: documentType,
                search: search,
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20,
            });
            return res.status(200).json({
                status: 'success',
                data: result,
            });
        }
        catch (error) {
            return res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to retrieve compliance audit logs',
            });
        }
    }
}
exports.LegalDocumentController = LegalDocumentController;
