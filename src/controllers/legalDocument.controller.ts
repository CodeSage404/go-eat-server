import { Request, Response } from 'express';
import { LegalDocumentService } from '../services/legalDocument.service';
import { LegalDocumentType, LegalCountryCode } from '../models/legalDocument.model';
import { logPlatformActivity } from '../utils/auditLogger';

export class LegalDocumentController {
  /**
   * Admin publishes or updates a legal document
   */
  public static async publishDocument(req: Request, res: Response) {
    try {
      const {
        documentType,
        targetRole,
        country,
        title,
        content,
        version,
        summaryOfChanges,
        effectiveDate,
        isPublished,
      } = req.body;

      if (!documentType || !title || !content) {
        return res.status(400).json({
          status: 'error',
          message: 'documentType, title, and content are required fields',
        });
      }

      const adminUserId = (req as any).user?._id;
      const doc = await LegalDocumentService.publishDocument(
        {
          documentType,
          targetRole: targetRole || 'all',
          country: (country || 'ALL').toUpperCase() as LegalCountryCode,
          title,
          content,
          version,
          summaryOfChanges,
          effectiveDate,
          isPublished: isPublished !== undefined ? isPublished : true,
        },
        adminUserId
      );

      logPlatformActivity({
        user: (req as any).user?.name || (req as any).user?.email || 'Admin',
        action: `Admin published legal policy: "${title || documentType}" for market ${country || 'ALL'} [v${version || '1.0'}]`,
        category: 'legal',
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
        status: 'success',
      });

      return res.status(200).json({
        status: 'success',
        message: 'Legal document published successfully',
        data: { document: doc },
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to publish legal document',
      });
    }
  }

  /**
   * Get single active document by type, country, and role (Public)
   */
  public static async getDocument(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const { country = 'NG', role = 'users' } = req.query;

      const doc = await LegalDocumentService.getActiveDocument(
        type as LegalDocumentType,
        country as string,
        role as string
      );

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
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to retrieve legal document',
      });
    }
  }

  /**
   * List all documents (Admin view)
   */
  public static async listDocuments(req: Request, res: Response) {
    try {
      const { country, targetRole, documentType } = req.query;
      const docs = await LegalDocumentService.listDocuments({
        country: country as string,
        targetRole: targetRole as string,
        documentType: documentType as string,
      });

      return res.status(200).json({
        status: 'success',
        results: docs.length,
        data: { documents: docs },
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to list legal documents',
      });
    }
  }

  /**
   * Check pending acceptances for current authenticated user
   */
  public static async getPendingAcceptances(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
      }

      const pending = await LegalDocumentService.getPendingAcceptancesForUser(user);
      return res.status(200).json({
        status: 'success',
        data: {
          hasPendingAcceptances: pending.length > 0,
          pendingDocuments: pending,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to check pending acceptances',
      });
    }
  }

  /**
   * User/Rider/Partner records acceptance of updated terms
   */
  public static async acceptDocument(req: Request, res: Response) {
    try {
      const user = (req as any).user;
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

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'] as string;

      const userCountry = (country || user.countryCode || user.country || 'NG').toUpperCase() as LegalCountryCode;
      const acceptance = await LegalDocumentService.recordAcceptance({
        userId: user._id.toString(),
        userName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
        userEmail: user.email,
        userRole: user.role || 'user',
        country: userCountry,
        documentType,
        ipAddress,
        userAgent,
      });

      logPlatformActivity({
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
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to log terms acceptance',
      });
    }
  }

  /**
   * Admin view of accepted terms audit register
   */
  public static async getAcceptancesAuditLog(req: Request, res: Response) {
    try {
      const { country, userRole, documentType, search, page, limit } = req.query;
      const result = await LegalDocumentService.getAcceptancesAuditLog({
        country: country as string,
        userRole: userRole as string,
        documentType: documentType as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to retrieve compliance audit logs',
      });
    }
  }
}
