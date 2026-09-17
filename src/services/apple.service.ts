import fs from 'fs';
import path from 'path';
import appleSignin, { AppleIdTokenType } from 'apple-signin-auth';
import logger from '../utils/logger';
import AppError from '../utils/appError';

class AppleService {
  private privateKey: string | null = null;

  constructor() {
    this.loadPrivateKey();
  }

  /**
   * Loads the Apple Private Key from apple-auth.txt or environment variable
   */
  public loadPrivateKey(): string | null {
    if (this.privateKey) return this.privateKey;

    // 1. Direct environment variable (standard in production/Render/Docker)
    if (process.env.APPLE_PRIVATE_KEY) {
      this.privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      logger.info('🍏 Apple private key loaded from APPLE_PRIVATE_KEY env var.');
      return this.privateKey;
    }

    // 2. File path (defaults to apple-auth.txt in server root)
    const possiblePaths = [
      process.env.APPLE_PRIVATE_KEY_PATH ? path.resolve(process.cwd(), process.env.APPLE_PRIVATE_KEY_PATH) : null,
      path.resolve(process.cwd(), 'apple-auth.txt'),
      path.resolve(__dirname, '../../apple-auth.txt'),
      path.resolve(__dirname, '../../../apple-auth.txt'),
    ].filter(Boolean) as string[];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        try {
          this.privateKey = fs.readFileSync(filePath, 'utf8').trim();
          logger.info(`🍏 Apple private key loaded successfully from: ${filePath}`);
          return this.privateKey;
        } catch (err: any) {
          logger.warn(`Failed reading Apple private key at ${filePath}: ${err.message}`);
        }
      }
    }

    logger.warn('⚠️ Apple private key not found in apple-auth.txt or APPLE_PRIVATE_KEY env var.');
    return null;
  }

  /**
   * Returns valid Apple Client IDs / App Bundle Identifiers
   */
  public getAllowedClientIds(): string[] {
    const list = [
      process.env.APPLE_CLIENT_ID,
      'com.emmanuelnwafor.goeat',
      'com.emmanuelnwafor.goeatpartners',
    ].filter(Boolean) as string[];

    // If comma-separated in APPLE_CLIENT_ID, split them
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_ID.includes(',')) {
      list.push(...process.env.APPLE_CLIENT_ID.split(',').map((id) => id.trim()));
    }

    return Array.from(new Set(list));
  }

  /**
   * Generates a signed Apple Client Secret JWT using the private key
   */
  public getClientSecret(clientId?: string): string {
    const privateKey = this.loadPrivateKey();
    if (!privateKey) {
      throw new AppError('Apple private key is not configured on the server.', 500);
    }

    const teamID = process.env.APPLE_TEAM_ID;
    const keyIdentifier = process.env.APPLE_KEY_ID;
    const clientID = clientId || process.env.APPLE_CLIENT_ID || 'com.emmanuelnwafor.goeat';

    if (!teamID || !keyIdentifier) {
      throw new AppError('APPLE_TEAM_ID and APPLE_KEY_ID environment variables are required to generate Apple client secret.', 500);
    }

    return appleSignin.getClientSecret({
      clientID,
      teamID,
      keyIdentifier,
      privateKey,
      expAfter: 15777000, // ~6 months (Apple max allowed expiration)
    });
  }

  /**
   * Verifies an Apple Identity Token (JWT) sent by iOS or Web client
   */
  public async verifyIdToken(idToken: string): Promise<AppleIdTokenType> {
    const allowedAudiences = this.getAllowedClientIds();

    try {
      const payload = await appleSignin.verifyIdToken(idToken, {
        audience: allowedAudiences.length > 1 ? allowedAudiences : allowedAudiences[0],
        ignoreExpiration: false,
      });

      return payload;
    } catch (err: any) {
      logger.error('❌ [Apple Auth Verification Failed]:', err.message || err);
      throw new AppError(`Invalid Apple identity token: ${err.message || 'Verification failed'}`, 401);
    }
  }

  /**
   * Exchanges an authorization code with Apple token endpoint (optional)
   */
  public async exchangeCode(code: string, clientId?: string, redirectUri: string = ''): Promise<any> {
    const clientSecret = this.getClientSecret(clientId);
    const clientID = clientId || process.env.APPLE_CLIENT_ID || 'com.emmanuelnwafor.goeat';

    return await appleSignin.getAuthorizationToken(code, {
      clientID,
      clientSecret,
      redirectUri,
    });
  }

  /**
   * Revokes Apple user tokens (for Apple account deletion compliance Guideline 5.1.1(v))
   */
  public async revokeToken(token: string, type: 'refresh_token' | 'access_token' = 'refresh_token', clientId?: string): Promise<void> {
    const clientSecret = this.getClientSecret(clientId);
    const clientID = clientId || process.env.APPLE_CLIENT_ID || 'com.emmanuelnwafor.goeat';

    await appleSignin.revokeAuthorizationToken(token, {
      clientID,
      clientSecret,
      tokenTypeHint: type,
    });
  }
}

export const appleService = new AppleService();