import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class CookieController {
  /**
   * Sets the cookie consent preference in the HTTP response cookies
   */
  public setConsent = catchAsync(async (req: Request, res: Response) => {
    const { consent } = req.body;

    if (!consent || (consent !== 'all' && consent !== 'required')) {
      throw new AppError('Consent must be either "all" or "required"', 400);
    }

    // Set cookie: HttpOnly, Secure if production, expires in 1 year
    res.cookie('cookie_consent', consent, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({
      status: 'success',
      message: `Cookie consent set to: ${consent}`,
      data: {
        consent
      }
    });
  });

  /**
   * Retrieves the current cookie consent preference from HTTP request cookies
   */
  public getConsent = catchAsync(async (req: Request, res: Response) => {
    const cookieHeader = req.headers.cookie;
    let consent = null;

    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|; )cookie_consent=([^;]*)/);
      if (match) {
        consent = decodeURIComponent(match[1]);
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        consent
      }
    });
  });
}

export default new CookieController();
