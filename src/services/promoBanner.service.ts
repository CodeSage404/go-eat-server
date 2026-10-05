import PromoBanner, { IPromoBanner } from '../models/promoBanner.model';
import Promo from '../models/promo.model';

class PromoBannerService {
  /**
   * Generates default slots for 4 distinct promotional banners
   */
  public getDefaultSlides(base?: any): any[] {
    return [
      {
        isActive: true,
        headline: base?.headline || 'Save ₦3,000',
        subtitle: base?.subtitle || 'Enjoy ₦1,000 off your first three orders. Min. spend applies. T&Cs apply.',
        ctaText: base?.ctaText || 'Order now',
        ctaLink: base?.ctaLink || '/voucher',
        voucherText: base?.voucherText || '₦1,000 off',
        imageUrl: base?.imageUrl || '',
        bannerType: base?.bannerType || 'side',
        backgroundColor: base?.backgroundColor || '#F5B743',
        backgroundColorDark: base?.backgroundColorDark || '#D99B26',
      },
      {
        isActive: true,
        headline: 'Free Delivery Week',
        subtitle: 'Zero delivery fees on all orders from selected restaurants near you.',
        ctaText: 'Claim free delivery',
        ctaLink: '/deals',
        voucherText: 'Free Delivery',
        imageUrl: '',
        bannerType: 'side',
        backgroundColor: '#004320',
        backgroundColorDark: '#002B14',
      },
      {
        isActive: true,
        headline: 'Craving Something Special?',
        subtitle: 'Explore freshly made local favorites and top-rated cuisines in your area.',
        ctaText: 'Explore spots',
        ctaLink: '/spots',
        voucherText: 'Trending',
        imageUrl: '',
        bannerType: 'side',
        backgroundColor: '#E05A47',
        backgroundColorDark: '#BF3D2B',
      },
      {
        isActive: true,
        headline: 'Earn Go-Eat Rewards',
        subtitle: 'Collect stamps with every order and unlock delicious free rewards.',
        ctaText: 'View rewards',
        ctaLink: '/rewards',
        voucherText: 'Free Meals',
        imageUrl: '',
        bannerType: 'side',
        backgroundColor: '#1E3A8A',
        backgroundColorDark: '#172554',
      },
    ];
  }

  /**
   * Helper to perform a randomized Fisher-Yates shuffle on an array
   */
  private shuffleArray(array: any[]): any[] {
    const cloned = [...array];
    for (let i = cloned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
  }

  /**
   * Retrieves the promo banner config. Ensures at least one singleton record exists.
   */
  async getOrCreateBanner(): Promise<IPromoBanner> {
    let banner = await PromoBanner.findOne();
    if (!banner) {
      banner = await PromoBanner.create({
        isActive: true,
        isCarouselEnabled: false,
        topSpotsTitle: 'Neighborhood Favorites',
        offersTitle: 'Tasty Offers',
        offersSubtitle: 'Tailored to your taste buds',
        headline: 'Save ₦3,000',
        subtitle: 'Enjoy ₦1,000 off your first three orders. Min. spend applies. T&Cs apply.',
        ctaText: 'Order now',
        ctaLink: '/voucher',
        voucherText: '₦1,000 off',
        imageUrl: '',
        backgroundColor: '#F5B743',
        backgroundColorDark: '#D99B26',
        slides: this.getDefaultSlides(),
      });
    } else if (!banner.slides || banner.slides.length === 0) {
      banner.slides = this.getDefaultSlides(banner);
      await banner.save();
    }
    return banner;
  }

  /**
   * Returns promo banner configuration for mobile apps / customer clients.
   */
  async getActiveBanner(): Promise<IPromoBanner | null> {
    const result = await this.getActiveBanners();
    return result.banner;
  }

  /**
   * Returns active banners with randomized rotation for each user session/request.
   * If admin has disabled promo banner, returns empty list.
   */
  async getActiveBanners(): Promise<{ banner: IPromoBanner | null; banners: any[] }> {
    const primaryBanner = await this.getOrCreateBanner();

    if (!primaryBanner || primaryBanner.isActive === false) {
      return {
        banner: null,
        banners: [],
      };
    }

    // Collect all active banners from slides (up to 4)
    let activeList: any[] = [];
    if (primaryBanner.slides && primaryBanner.slides.length > 0) {
      activeList = primaryBanner.slides
        .filter((s: any) => s && s.isActive !== false)
        .map((s: any) => {
          const doc = typeof s.toObject === 'function' ? s.toObject() : { ...s };
          return {
            ...doc,
            topSpotsTitle: primaryBanner.topSpotsTitle,
            offersTitle: primaryBanner.offersTitle,
            offersSubtitle: primaryBanner.offersSubtitle,
          };
        });
    }

    // Fallback: if no active slides exist, use the primary root banner fields
    if (activeList.length === 0) {
      activeList = [primaryBanner];
    }

    // Randomized Fisher-Yates rotation so each user session / app open gets a fresh banner
    const shuffled = this.shuffleArray(activeList);

    return {
      banner: shuffled[0] || primaryBanner,
      banners: shuffled,
    };
  }

  /**
   * Returns banner configuration for Admin dashboard with all 4 slots populated.
   */
  async getAdminBanner(): Promise<IPromoBanner> {
    const banner = await this.getOrCreateBanner();
    if (!banner.slides || banner.slides.length < 4) {
      const defaults = this.getDefaultSlides(banner);
      const existing = banner.slides || [];
      const merged = [...existing];
      for (let i = existing.length; i < 4; i++) {
        merged.push(defaults[i]);
      }
      banner.slides = merged as any;
      await banner.save();
    }
    return banner;
  }

  /**
   * Updates banner settings (toggle active, update copy, image, 4 slides, etc.)
   */
  async updateBanner(payload: Partial<IPromoBanner>): Promise<IPromoBanner> {
    const banner = await this.getOrCreateBanner();

    if (payload.isActive !== undefined) banner.isActive = payload.isActive;
    if (payload.isCarouselEnabled !== undefined) banner.isCarouselEnabled = payload.isCarouselEnabled;
    if (payload.slides !== undefined) banner.slides = payload.slides;
    if (payload.topSpotsTitle !== undefined) banner.topSpotsTitle = payload.topSpotsTitle;
    if (payload.offersTitle !== undefined) banner.offersTitle = payload.offersTitle;
    if (payload.offersSubtitle !== undefined) banner.offersSubtitle = payload.offersSubtitle;
    if (payload.headline !== undefined) banner.headline = payload.headline;
    if (payload.subtitle !== undefined) banner.subtitle = payload.subtitle;
    if (payload.ctaText !== undefined) banner.ctaText = payload.ctaText;
    if (payload.ctaLink !== undefined) banner.ctaLink = payload.ctaLink;
    if (payload.voucherText !== undefined) banner.voucherText = payload.voucherText;
    if (payload.imageUrl !== undefined) banner.imageUrl = payload.imageUrl;
    if (payload.bannerType !== undefined) banner.bannerType = payload.bannerType;
    if (payload.backgroundColor !== undefined) banner.backgroundColor = payload.backgroundColor;
    if (payload.backgroundColorDark !== undefined) banner.backgroundColorDark = payload.backgroundColorDark;

    // Sync root fields with the first slide for backwards compatibility
    if (payload.slides && payload.slides.length > 0 && payload.slides[0]) {
      const s0 = payload.slides[0];
      if (s0.headline) banner.headline = s0.headline;
      if (s0.subtitle) banner.subtitle = s0.subtitle;
      if (s0.ctaText) banner.ctaText = s0.ctaText;
      if (s0.ctaLink) banner.ctaLink = s0.ctaLink;
      if (s0.voucherText) banner.voucherText = s0.voucherText;
      if (s0.imageUrl !== undefined) banner.imageUrl = s0.imageUrl;
      if (s0.bannerType) banner.bannerType = s0.bannerType;
      if (s0.backgroundColor) banner.backgroundColor = s0.backgroundColor;
      if (s0.backgroundColorDark) banner.backgroundColorDark = s0.backgroundColorDark;
    }

    await banner.save();
    return banner;
  }
}

export default new PromoBannerService();
