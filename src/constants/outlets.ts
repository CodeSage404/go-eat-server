export type MainOutletType = 
  | 'Restaurant' 
  | 'Smokey Wheel' 
  | 'Grocery' 
  | 'Health & Wellness' 
  | 'Convenience' 
  | 'Lifestyle';

export interface OutletCategory {
  name: string;
  description?: string;
}

export interface OutletConfig {
  id: MainOutletType;
  title: MainOutletType;
  description: string;
  categories: OutletCategory[];
  onboardingRequirements: {
    identity: string[];
    business: string[];
    compliance: string[];
    photos: string[];
    menuOrProducts: string[];
  };
}

export const MAIN_OUTLETS: Record<MainOutletType, OutletConfig> = {
  'Restaurant': {
    id: 'Restaurant',
    title: 'Restaurant',
    description: 'Delicious meals from top restaurants near you.',
    categories: [
      { name: 'Starter Meal', description: 'Light bites and appetizers to start your meal.' },
      { name: 'Rice Dish', description: 'Local & international rice recipes.' },
      { name: 'Hand Dipped (Swallow) & Soup', description: 'Traditional Nigerian swallows with delicious soups.' },
      { name: 'Pizza & Dough Recipe', description: 'Pizza, buns, sandwiches and dough delights.' },
      { name: 'Grill & Wrap', description: 'Grilled meals, kebabs, suya, wraps & more.' },
      { name: 'Drink & Beverage', description: 'Refreshing drinks, juices, smoothies & more.' },
      { name: 'Dessert', description: 'Sweet treats to complete your meal.' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name (Optional)', 'Business Category', 'Business Description', 'Business Address', 'State', 'LGA', 'Delivery Radius', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'CAC Registration (Optional)'],
      compliance: ['Food Hygiene Certificate (Issue & Expiry Date)', 'Government Health & Safety Certificate (Expiry Date)'],
      photos: ['Business Logo', 'Cover Photo', 'Kitchen', 'Cooking Area', 'Storage Area', 'Food Preparation Area'],
      menuOrProducts: ['Menu Categories', 'Food Photos', 'Prices'],
    },
  },
  'Smokey Wheel': {
    id: 'Smokey Wheel',
    title: 'Smokey Wheel',
    description: 'Authentic Nigerian street food from trusted vendors.',
    categories: [
      { name: 'Skewers & Grills', description: 'Suya, chicken, gizzard, beef, turkey & more.' },
      { name: 'Fried Bites', description: 'Puff puff, akara, chin chin, buns & more.' },
      { name: 'Staple Bites', description: 'Roasted plantain, corn, yam, potato & more.' },
      { name: 'Street Meals', description: 'Moi moi, masa, nkwobi, bowls & more.' },
      { name: 'Refreshments', description: 'Zobo, kunu, soba, fruit drinks & more.' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name (Optional)', 'Business Category', 'Business Description', 'Business Address', 'State', 'LGA', 'Delivery Radius', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'CAC Registration (Optional)'],
      compliance: ['Food Hygiene Certificate (Issue & Expiry Date)', 'Government Health & Safety Certificate (Expiry Date)'],
      photos: ['Business Logo', 'Cover Photo', 'Kitchen', 'Cooking Area', 'Storage Area', 'Food Preparation Area'],
      menuOrProducts: ['Street Food Categories', 'Food Images', 'Prices'],
    },
  },
  'Grocery': {
    id: 'Grocery',
    title: 'Grocery',
    description: 'Groceries and essentials delivered to your door.',
    categories: [
      { name: 'Fruits & Vegetables' },
      { name: 'Meat & Seafood' },
      { name: 'Pantry Essentials' },
      { name: 'Dairy & Eggs' },
      { name: 'Snacks & Beverages' },
      { name: 'Baby & Kids' },
      { name: 'Household & Cleaning' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name (Optional)', 'Business Category', 'Business Description', 'Business Address', 'State', 'LGA', 'Delivery Radius', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'CAC Registration (Optional)', 'Business License (Optional)'],
      compliance: [],
      photos: ['Business Logo', 'Cover Photo', 'Shop Front', 'Interior'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
  'Health & Wellness': {
    id: 'Health & Wellness',
    title: 'Health & Wellness',
    description: 'Health products, vitamins and wellness essentials delivered.',
    categories: [
      { name: 'Pharmacy' },
      { name: 'Vitamins & Supplements' },
      { name: 'Personal Care' },
      { name: 'Fitness & Nutrition' },
      { name: 'Medical Devices' },
      { name: 'Health Services' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name (Optional)', 'Business Category', 'Business Description', 'Business Address', 'State', 'LGA', 'Delivery Radius', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'CAC Registration (Optional)'],
      compliance: ['Government Permits (Pharmacy Licence or Health Practice Permit)'],
      photos: ['Business Logo', 'Cover Photo', 'Shop Front'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
  'Convenience': {
    id: 'Convenience',
    title: 'Convenience',
    description: 'Everyday essentials and quick picks, delivered fast.',
    categories: [
      { name: 'Daily Essentials' },
      { name: 'Snacks & Drinks' },
      { name: 'Frozen Foods' },
      { name: 'Alcoholic Beverages' },
      { name: 'Top-Up & Vouchers' },
      { name: 'Stationery & Office' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name (Optional)', 'Business Category', 'Business Description', 'Business Address', 'State', 'LGA', 'Delivery Radius', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'CAC Registration (Optional)', 'Business License (Optional)'],
      compliance: [],
      photos: ['Business Logo', 'Cover Photo', 'Shop Front', 'Store Images'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
  'Lifestyle': {
    id: 'Lifestyle',
    title: 'Lifestyle',
    description: 'Shop fashion, beauty, electronics and more with ease.',
    categories: [
      { name: 'Fashion' },
      { name: 'Beauty & Personal Care' },
      { name: 'Electronics' },
      { name: 'Home & Living' },
      { name: 'Toys & Games' },
      { name: 'Gifts & Occasions' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name (Optional)', 'Business Category', 'Business Description', 'Business Address', 'State', 'LGA', 'Delivery Radius', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'CAC Registration (Optional)'],
      compliance: [],
      photos: ['Business Logo', 'Cover Photo', 'Store Images', 'Brand Images'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
};

export const MAIN_OUTLETS_ARRAY: OutletConfig[] = Object.values(MAIN_OUTLETS);
