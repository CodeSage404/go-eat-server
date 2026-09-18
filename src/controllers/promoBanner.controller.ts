import { Request, Response } from 'express';
import promoBannerService from '../services/promoBanner.service';
import { catchAsync } from '../utils/catchAsync';

class PromoBannerController {
  /**
   * Client/User App: Get active promo banner and banners carousel
   */
  public getActiveBanner = catchAsync(async (req: Request, res: Response) => {
    const result = await promoBannerService.getActiveBanners();
    res.status(200).json({
      status: 'success',
      data: {
        banner: result.banner,
        banners: result.banners,
      },
    });
  });

  /**
   * Admin: Get promo banner configuration
   */
  public getAdminBanner = catchAsync(async (req: Request, res: Response) => {
    const banner = await promoBannerService.getAdminBanner();
    res.status(200).json({
      status: 'success',
      data: { banner },
    });
  });

  /**
   * Admin: Update promo banner configuration & toggle state
   */
  public updateBanner = catchAsync(async (req: Request, res: Response) => {
    const banner = await promoBannerService.updateBanner(req.body);
    res.status(200).json({
      status: 'success',
      data: { banner },
    });
  });
}

export default new PromoBannerController();
