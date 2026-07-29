export type MainOutletType = 
  | 'Restaurant' 
  | 'Smokey Wheel' 
  | 'Grocery' 
  | 'Specialty Store' 
  | 'Convenience'
  | 'Health & Wellness' // Maintained for backwards compatibility
  | 'Lifestyle';        // Maintained for backwards compatibility

export interface OutletCategory {
  name: string;
  description?: string;
  subcategories?: string[];
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

export const MAIN_OUTLETS: Record<string, OutletConfig> = {
  'Restaurant': {
    id: 'Restaurant',
    title: 'Restaurant',
    description: 'Delicious meals from top restaurants near you.',
    categories: [
      { 
        name: 'Starters', 
        description: 'Light bites and appetizers to start your meal.',
        subcategories: ['Soup', 'Spring Rolls', 'Chicken Wings', 'Salad', 'Small Chops'] 
      },
      { 
        name: 'Main Meals', 
        description: 'Local & international main courses and swallows.',
        subcategories: ['Rice', 'Pasta', 'Pizza', 'Burgers', 'Shawarma', 'Sandwiches', 'Swallow', 'Local Dishes', 'Seafood'] 
      },
      { 
        name: 'Desserts', 
        description: 'Sweet treats to complete your meal.',
        subcategories: ['Cake', 'Ice Cream', 'Cheesecake', 'Doughnuts', 'Fruit'] 
      },
      { 
        name: 'Drinks', 
        description: 'Refreshing drinks, juices, smoothies & more.',
        subcategories: ['Soft Drinks', 'Juice', 'Smoothies', 'Coffee', 'Tea', 'Milkshake', 'Energy Drinks'] 
      },
      { name: 'Breakfast', description: 'Morning meals and breakfast specials.' },
      { name: 'Kids Meals', description: 'Specially curated meals for kids.' },
      { name: 'Vegan', description: '100% plant-based recipes.' },
      { name: 'Vegetarian', description: 'Meat-free vegetarian dishes.' },
      { name: 'Combos', description: 'Value meal combinations.' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name', 'Business Category', 'Business Address', 'State', 'City', 'Country', 'GPS Pin', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'VAT/Tax Number (Optional)'],
      compliance: ['Food Licence (Mandatory for Restaurant)', 'Government Health & Safety Certificate'],
      photos: ['Store Logo', 'Banner Image', 'Kitchen Area', 'Food Preparation Area'],
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
      business: ['Business Name', 'Trading Name', 'Business Category', 'Business Address', 'State', 'City', 'Country', 'GPS Pin', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'VAT/Tax Number (Optional)'],
      compliance: ['Food Licence (Mandatory for Street Vendors)'],
      photos: ['Store Logo', 'Banner Image', 'Cooking Area'],
      menuOrProducts: ['Street Food Categories', 'Food Images', 'Prices'],
    },
  },
  'Grocery': {
    id: 'Grocery',
    title: 'Grocery',
    description: 'Groceries and essentials delivered to your door.',
    categories: [
      { name: 'Fresh Produce', subcategories: ['Vegetables', 'Fruits', 'Herbs'] },
      { name: 'Meat & Poultry' },
      { name: 'Fish & Seafood' },
      { name: 'Dairy & Eggs' },
      { name: 'Bakery' },
      { name: 'Frozen Foods' },
      { name: 'Snacks' },
      { name: 'Drinks' },
      { name: 'Pantry', subcategories: ['Rice', 'Beans', 'Flour', 'Oil', 'Pasta'] },
      { name: 'Baby Products' },
      { name: 'Household' },
      { name: 'Cleaning Supplies' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name', 'Business Category', 'Business Address', 'State', 'City', 'Country', 'GPS Pin', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'VAT/Tax Number (Optional)'],
      compliance: [], // Food Licence exempt for standard grocery
      photos: ['Store Logo', 'Banner Image', 'Shop Front', 'Interior'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
  'Specialty Store': {
    id: 'Specialty Store',
    title: 'Specialty Store',
    description: 'Unique specialty shops delivering exactly what you need.',
    categories: [
      { name: 'Health & Wellness' },
      { name: 'Pet Shop', subcategories: ['Pet Food', 'Toys', 'Accessories'] },
      { name: 'Flower Shop' },
      { name: 'Baby Store' },
      { name: 'Organic Foods' },
      { name: 'Book & Stationery Store' },
      { name: 'Gifts' },
      { name: 'Chocolates' },
      { name: 'Cakes' },
      { name: 'Wine & Hampers' },
      { name: 'Pharmacy' },
      { name: 'Cosmetics' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name', 'Business Category', 'Business Address', 'State', 'City', 'Country', 'GPS Pin', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'VAT/Tax Number (Optional)'],
      compliance: [], // Licence optional depending on subcategory (e.g., Pharmacy permit)
      photos: ['Store Logo', 'Banner Image', 'Shop Front'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
  'Convenience': {
    id: 'Convenience',
    title: 'Convenience',
    description: 'Everyday essentials and quick picks, delivered fast.',
    categories: [
      { name: 'Drinks' },
      { name: 'Snacks' },
      { name: 'Ready Meals' },
      { name: 'Ice Cream' },
      { name: 'Toiletries' },
      { name: 'Cigarettes (where legally permitted)' },
      { name: 'Household Essentials' },
      { name: 'Baby Care' },
      { name: 'Phone Accessories' },
      { name: 'Over-the-Counter Medicines' },
    ],
    onboardingRequirements: {
      identity: ['NIN Verification', 'Owner Full Name', 'Date of Birth', 'Phone Number', 'Email Address', 'Residential Address', 'Selfie Verification'],
      business: ['Business Name', 'Trading Name', 'Business Category', 'Business Address', 'State', 'City', 'Country', 'GPS Pin', 'Business Phone Number', 'Business Email', 'Opening Hours', 'Bank Account Details (BVN & Automatic Name Match)', 'VAT/Tax Number (Optional)'],
      compliance: [],
      photos: ['Store Logo', 'Banner Image', 'Shop Front'],
      menuOrProducts: ['Product Images', 'Prices'],
    },
  },
};

export const MAIN_OUTLETS_ARRAY: OutletConfig[] = [
  MAIN_OUTLETS['Restaurant'],
  MAIN_OUTLETS['Smokey Wheel'],
  MAIN_OUTLETS['Grocery'],
  MAIN_OUTLETS['Specialty Store'],
  MAIN_OUTLETS['Convenience'],
];
