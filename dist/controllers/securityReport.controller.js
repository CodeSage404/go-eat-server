"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityReportController = void 0;
const vulnerabilityReport_model_1 = require("../models/vulnerabilityReport.model");
const crypto_1 = __importDefault(require("crypto"));
class SecurityReportController {
    /**
     * Generates a collision-resistant unique ticket ID in format: GOE-SEC-YYYY-XXXX
     */
    static generateTicketId() {
        const year = new Date().getFullYear();
        const randomHex = crypto_1.default.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
        return `GOE-SEC-${year}-${randomHex}`;
    }
    /**
     * Public endpoint to submit a security vulnerability report
     */
    static async submitReport(req, res) {
        try {
            const { reporterName, reporterEmail, reporterType, platform, category, title, description, reproductionSteps, affectedUrl, potentialImpact, reporterSeverity, } = req.body;
            if (!platform || !category || !title || !description) {
                return res.status(400).json({
                    success: false,
                    message: 'Required fields missing: platform, category, title, description',
                });
            }
            const publicReference = SecurityReportController.generateTicketId();
            // Process attachments if any uploaded via multer or sent in body
            const attachments = [];
            if (req.files && Array.isArray(req.files)) {
                for (const file of req.files) {
                    attachments.push({
                        safeFileName: `${publicReference}-${file.filename || file.originalname}`,
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        sizeBytes: file.size,
                        filePath: file.path || '',
                        scanStatus: 'clean',
                        uploadedAt: new Date(),
                    });
                }
            }
            const report = await vulnerabilityReport_model_1.VulnerabilityReport.create({
                publicReference,
                reporterName: reporterName ? String(reporterName).trim().slice(0, 100) : undefined,
                reporterEmail: reporterEmail ? String(reporterEmail).trim().toLowerCase().slice(0, 150) : undefined,
                reporterType: reporterType || 'researcher',
                platform,
                category,
                title: String(title).trim().slice(0, 200),
                description: String(description).trim(),
                reproductionSteps: reproductionSteps ? String(reproductionSteps).trim() : undefined,
                affectedUrl: affectedUrl ? String(affectedUrl).trim().slice(0, 300) : undefined,
                potentialImpact: potentialImpact ? String(potentialImpact).trim() : undefined,
                reporterSeverity: reporterSeverity || 'unsure',
                assignedSeverity: 'none',
                status: 'received',
                attachments,
                internalNotes: [],
                auditEvents: [
                    {
                        action: 'REPORT_SUBMITTED',
                        actorName: reporterName || 'Anonymous Reporter',
                        timestamp: new Date(),
                    },
                ],
            });
            return res.status(201).json({
                success: true,
                message: 'Security report securely submitted. Thank you for helping keep GoEatOne safe.',
                ticketId: publicReference,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Unable to submit report at this time. Please try again later.',
            });
        }
    }
    /**
     * Admin endpoint: List vulnerability reports with filters
     */
    static async listReports(req, res) {
        try {
            const { status, platform, category, severity, page = 1, limit = 20 } = req.query;
            const query = {};
            if (status && status !== 'all')
                query.status = status;
            if (platform && platform !== 'all')
                query.platform = platform;
            if (category && category !== 'all')
                query.category = category;
            if (severity && severity !== 'all')
                query.assignedSeverity = severity;
            const skip = (Number(page) - 1) * Number(limit);
            const total = await vulnerabilityReport_model_1.VulnerabilityReport.countDocuments(query);
            const reports = await vulnerabilityReport_model_1.VulnerabilityReport.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .select('-description -reproductionSteps'); // Exclude full details in list view for security
            return res.status(200).json({
                success: true,
                total,
                page: Number(page),
                limit: Number(limit),
                reports,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to list reports',
            });
        }
    }
    /**
     * Admin endpoint: Get full report details
     */
    static async getReportDetails(req, res) {
        try {
            const { id } = req.params;
            const report = await vulnerabilityReport_model_1.VulnerabilityReport.findById(id);
            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }
            return res.status(200).json({
                success: true,
                report,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to retrieve report',
            });
        }
    }
    /**
     * Admin endpoint: Update report status, assigned severity, or owner
     */
    static async updateReport(req, res) {
        try {
            const { id } = req.params;
            const { status, assignedSeverity, ownerName } = req.body;
            const adminUser = req.user;
            const report = await vulnerabilityReport_model_1.VulnerabilityReport.findById(id);
            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }
            if (status)
                report.status = status;
            if (assignedSeverity)
                report.assignedSeverity = assignedSeverity;
            if (ownerName)
                report.ownerName = ownerName;
            report.auditEvents.push({
                action: 'REPORT_UPDATED',
                actorId: adminUser?._id,
                actorName: adminUser?.fullName || adminUser?.name || 'Admin',
                timestamp: new Date(),
                metadata: { status, assignedSeverity, ownerName },
            });
            if (status === 'resolved' && !report.resolvedAt)
                report.resolvedAt = new Date();
            if (status === 'closed' && !report.closedAt)
                report.closedAt = new Date();
            await report.save();
            return res.status(200).json({
                success: true,
                message: 'Report updated successfully',
                report,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update report',
            });
        }
    }
    /**
     * Admin endpoint: Add internal note
     */
    static async addInternalNote(req, res) {
        try {
            const { id } = req.params;
            const { note } = req.body;
            const adminUser = req.user;
            if (!note || !String(note).trim()) {
                return res.status(400).json({ success: false, message: 'Note content is required' });
            }
            const report = await vulnerabilityReport_model_1.VulnerabilityReport.findById(id);
            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }
            report.internalNotes.push({
                authorId: adminUser?._id,
                authorName: adminUser?.fullName || adminUser?.name || 'Security Staff',
                note: String(note).trim(),
                createdAt: new Date(),
            });
            await report.save();
            return res.status(200).json({
                success: true,
                message: 'Internal note added successfully',
                notes: report.internalNotes,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to add note',
            });
        }
    }
}
exports.SecurityReportController = SecurityReportController;
