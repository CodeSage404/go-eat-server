"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpiryDates = exports.updateDocumentStatus = exports.getOwnerDocuments = exports.uploadDocument = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const document_model_1 = __importDefault(require("../models/document.model"));
exports.uploadDocument = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { documentName, documentType, expiryDate, issueDate, ownerType, ownerId, fileUrl, } = req.body;
    if (!documentName || !documentType || !ownerType || !ownerId || !fileUrl) {
        throw new appError_1.default('Please provide all required document fields', 400);
    }
    const newDoc = await document_model_1.default.create({
        documentName,
        documentType,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        ownerType,
        ownerId,
        fileUrl,
        verificationStatus: 'pending',
        expiryAlertSent: 'none',
    });
    res.status(201).json({
        status: 'success',
        data: {
            document: newDoc,
        },
    });
});
exports.getOwnerDocuments = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { ownerType, ownerId } = req.params;
    const documents = await document_model_1.default.find({
        ownerType: ownerType,
        ownerId: ownerId,
    }).sort({ createdAt: -1 });
    res.status(200).json({
        status: 'success',
        results: documents.length,
        data: {
            documents,
        },
    });
});
exports.updateDocumentStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const { verificationStatus, rejectionReason } = req.body;
    if (!['pending', 'verified', 'rejected', 'expired', 'update_requested'].includes(verificationStatus)) {
        throw new appError_1.default('Invalid verification status', 400);
    }
    const document = await document_model_1.default.findByIdAndUpdate(id, {
        verificationStatus,
        rejectionReason: verificationStatus === 'rejected' ? rejectionReason : undefined,
    }, { new: true, runValidators: true });
    if (!document) {
        throw new appError_1.default('Document not found', 404);
    }
    res.status(200).json({
        status: 'success',
        data: {
            document,
        },
    });
});
exports.checkExpiryDates = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    // 1. Mark expired documents
    const expiredResult = await document_model_1.default.updateMany({
        expiryDate: { $lt: now },
        verificationStatus: { $ne: 'expired' },
    }, {
        $set: {
            verificationStatus: 'expired',
            expiryAlertSent: 'expired',
        },
    });
    // 2. Query documents expiring within 30, 14, 7 days that haven't had their corresponding alerts sent
    const thirtyDayDocs = await document_model_1.default.find({
        expiryDate: { $gte: now, $lte: thirtyDaysFromNow },
        expiryAlertSent: { $in: ['none'] },
    });
    const fourteenDayDocs = await document_model_1.default.find({
        expiryDate: { $gte: now, $lte: fourteenDaysFromNow },
        expiryAlertSent: { $in: ['none', '30_days'] },
    });
    const sevenDayDocs = await document_model_1.default.find({
        expiryDate: { $gte: now, $lte: sevenDaysFromNow },
        expiryAlertSent: { $in: ['none', '30_days', '14_days'] },
    });
    // Update alert statuses
    await document_model_1.default.updateMany({ _id: { $in: thirtyDayDocs.map((d) => d._id) } }, { $set: { expiryAlertSent: '30_days' } });
    await document_model_1.default.updateMany({ _id: { $in: fourteenDayDocs.map((d) => d._id) } }, { $set: { expiryAlertSent: '14_days' } });
    await document_model_1.default.updateMany({ _id: { $in: sevenDayDocs.map((d) => d._id) } }, { $set: { expiryAlertSent: '7_days' } });
    res.status(200).json({
        status: 'success',
        data: {
            expiredCount: expiredResult.modifiedCount,
            thirtyDayAlerts: thirtyDayDocs.length,
            fourteenDayAlerts: fourteenDayDocs.length,
            sevenDayAlerts: sevenDayDocs.length,
        },
    });
});
