import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import DocumentModel, { VerificationStatusType } from '../models/document.model';

export const uploadDocument = catchAsync(async (req: Request, res: Response) => {
  const {
    documentName,
    documentType,
    expiryDate,
    issueDate,
    ownerType,
    ownerId,
    fileUrl,
  } = req.body;

  if (!documentName || !documentType || !ownerType || !ownerId || !fileUrl) {
    throw new AppError('Please provide all required document fields', 400);
  }

  const newDoc = await DocumentModel.create({
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

export const getOwnerDocuments = catchAsync(async (req: Request, res: Response) => {
  const { ownerType, ownerId } = req.params;

  const documents = await DocumentModel.find({
    ownerType: ownerType as any,
    ownerId: ownerId as any,
  }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: documents.length,
    data: {
      documents,
    },
  });
});

export const updateDocumentStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { verificationStatus, rejectionReason } = req.body as {
    verificationStatus: VerificationStatusType;
    rejectionReason?: string;
  };

  if (!['pending', 'verified', 'rejected', 'expired', 'update_requested'].includes(verificationStatus)) {
    throw new AppError('Invalid verification status', 400);
  }

  const document = await DocumentModel.findByIdAndUpdate(
    id,
    {
      verificationStatus,
      rejectionReason: verificationStatus === 'rejected' ? rejectionReason : undefined,
    },
    { new: true, runValidators: true }
  );

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      document,
    },
  });
});

export const checkExpiryDates = catchAsync(async (req: Request, res: Response) => {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Mark expired documents
  const expiredResult = await DocumentModel.updateMany(
    {
      expiryDate: { $lt: now },
      verificationStatus: { $ne: 'expired' },
    } as any,
    {
      $set: {
        verificationStatus: 'expired',
        expiryAlertSent: 'expired',
      },
    }
  );

  // 2. Query documents expiring within 30, 14, 7 days that haven't had their corresponding alerts sent
  const thirtyDayDocs = await DocumentModel.find({
    expiryDate: { $gte: now, $lte: thirtyDaysFromNow },
    expiryAlertSent: { $in: ['none'] },
  } as any);

  const fourteenDayDocs = await DocumentModel.find({
    expiryDate: { $gte: now, $lte: fourteenDaysFromNow },
    expiryAlertSent: { $in: ['none', '30_days'] },
  } as any);

  const sevenDayDocs = await DocumentModel.find({
    expiryDate: { $gte: now, $lte: sevenDaysFromNow },
    expiryAlertSent: { $in: ['none', '30_days', '14_days'] },
  } as any);

  // Update alert statuses
  await DocumentModel.updateMany(
    { _id: { $in: thirtyDayDocs.map((d) => d._id) } },
    { $set: { expiryAlertSent: '30_days' } }
  );
  await DocumentModel.updateMany(
    { _id: { $in: fourteenDayDocs.map((d) => d._id) } },
    { $set: { expiryAlertSent: '14_days' } }
  );
  await DocumentModel.updateMany(
    { _id: { $in: sevenDayDocs.map((d) => d._id) } },
    { $set: { expiryAlertSent: '7_days' } }
  );

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
