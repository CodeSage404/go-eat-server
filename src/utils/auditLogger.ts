import AuditLog from '../models/auditLog.model';

export interface LogActivityParams {
  user: string;
  action: string;
  category: 'auth' | 'legal' | 'settings' | 'restaurants' | 'orders' | 'security' | string;
  ipAddress?: string;
  status?: 'success' | 'failed';
}

/**
 * Persists a high-level operational activity / audit log entry in the database.
 */
export async function logPlatformActivity(params: LogActivityParams): Promise<void> {
  try {
    await AuditLog.create({
      user: params.user || 'System',
      action: params.action,
      category: params.category || 'general',
      ipAddress: params.ipAddress || '127.0.0.1',
      status: params.status || 'success',
    });
  } catch (err) {
    console.warn('Failed to write platform audit log:', err);
  }
}
