import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

import Category from '../models/category.model';
import Restaurant, { RestaurantStatus, IRestaurant } from '../models/restaurant.model';
import FoodItem from '../models/foodItem.model';
import User, { UserRole } from '../models/user.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';

const seedCategories = [
  {
    name: 'Rice & Grains',
    slug: 'rice-grains',
    image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
    icon: 'rice-craving',
    description: 'Smoky Jollof Rice, Fried Rice, Ofada, and Basmati Delights',
    order: 1,
    isGlobal: true,
  },
  {
    name: 'Swallow & Soups',
    slug: 'swallow-soups',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    icon: 'eba-craving',
    description: 'Pounded Yam, Eba, Amala with Egusi, Ogbono, and Oha soup',
    order: 2,
    isGlobal: true,
  },
  {
    name: 'Fast Food & Chicken',
    slug: 'fast-food',
    image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
    icon: 'chicken-craving',
    description: 'Crispy Fried Chicken, Burgers, Chips, and Wraps',
    order: 3,
    isGlobal: true,
  },
  {
    name: 'Pizza & Bakery',
    slug: 'pizza-bakery',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    icon: 'pizza-craving',
    description: 'Freshly Baked Pizzas, Cakes, Pastries & Meatpies',
    order: 4,
    isGlobal: true,
  },
  {
    name: 'Drinks & Smoothies',
    slug: 'drinks-smoothies',
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    icon: 'drink-category',
    description: 'Refreshing Juices, Soft Drinks, Boba & Smoothies',
    order: 5,
    isGlobal: true,
  },
  {
    name: 'Groceries & Snacks',
    slug: 'groceries-snacks',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    icon: 'groceries-category',
    description: 'Everyday Groceries, Suya, Chips, & Household Essentials',
    order: 6,
    isGlobal: true,
  },
];

const seedRestaurants = [
  {
    name: 'Kilimanjaro Restaurant',
    description: 'Premium Nigerian & Continental dishes made fresh daily.',
    images: {
      logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
      cover: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    },
    address: {
      street: 'Chime Avenue, New Haven',
      city: 'Enugu',
      state: 'Enugu State',
      zipCode: '400211',
    },
    location: {
      type: 'Point' as const,
      coordinates: [7.5191, 6.3084] as [number, number],
    },
    cuisine: ['Nigerian', 'Rice', 'Fast Food'],
    rating: 4.8,
    numReviews: 342,
    estimatedDeliveryTime: 25,
    deliveryFee: 500,
    minOrderAmount: 1000,
    status: RestaurantStatus.ACTIVE,
    openingHours: { open: '08:00', close: '22:00' },
  },
  {
    name: 'Chicken Republic',
    description: 'Home of the famous Refuel Combo, Crunchy Chicken, and Citizens meal.',
    images: {
      logo: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?auto=format&fit=crop&w=300&q=80',
      cover: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
    },
    address: {
      street: 'Ogui Road',
      city: 'Enugu',
      state: 'Enugu State',
      zipCode: '400221',
    },
    location: {
      type: 'Point' as const,
      coordinates: [7.5021, 6.4412] as [number, number],
    },
    cuisine: ['Fast Food', 'Chicken', 'Rice'],
    rating: 4.7,
    numReviews: 512,
    estimatedDeliveryTime: 20,
    deliveryFee: 400,
    minOrderAmount: 800,
    status: RestaurantStatus.ACTIVE,
    openingHours: { open: '07:30', close: '22:30' },
  },
  {
    name: 'The Place Restaurant',
    description: 'Authentic Nigerian home-style cooking with grilled meats and special Parfait.',
    images: {
      logo: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=300&q=80',
      cover: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
    },
    address: {
      street: 'Victoria Island',
      city: 'Lagos',
      state: 'Lagos State',
      zipCode: '101241',
    },
    location: {
      type: 'Point' as const,
      coordinates: [3.4219, 6.4281] as [number, number],
    },
    cuisine: ['Nigerian', 'Grills', 'Soups'],
    rating: 4.9,
    numReviews: 890,
    estimatedDeliveryTime: 30,
    deliveryFee: 600,
    minOrderAmount: 1500,
    status: RestaurantStatus.ACTIVE,
    openingHours: { open: '08:00', close: '23:00' },
  },
  {
    name: 'Tantalizers',
    description: 'Classic pastries, Jollof rice bowls, beef rolls, and cold drinks.',
    images: {
      logo: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&q=80',
      cover: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=800&q=80',
    },
    address: {
      street: 'Presidential Road',
      city: 'Enugu',
      state: 'Enugu State',
      zipCode: '400241',
    },
    location: {
      type: 'Point' as const,
      coordinates: [7.5100, 6.4350] as [number, number],
    },
    cuisine: ['Bakery', 'Fast Food', 'Nigerian'],
    rating: 4.6,
    numReviews: 210,
    estimatedDeliveryTime: 25,
    deliveryFee: 450,
    minOrderAmount: 1000,
    status: RestaurantStatus.ACTIVE,
    openingHours: { open: '08:00', close: '21:30' },
  },
  {
    name: 'Genesis Restaurant & Bar',
    description: 'Fine dining, fried rice, seafood delight, and ice-cold smoothies.',
    images: {
      logo: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=300&q=80',
      cover: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80',
    },
    address: {
      street: 'Zik Avenue',
      city: 'Enugu',
      state: 'Enugu State',
      zipCode: '400231',
    },
    location: {
      type: 'Point' as const,
      coordinates: [7.4980, 6.4290] as [number, number],
    },
    cuisine: ['Continental', 'Nigerian', 'Seafood'],
    rating: 4.8,
    numReviews: 420,
    estimatedDeliveryTime: 25,
    deliveryFee: 500,
    minOrderAmount: 1200,
    status: RestaurantStatus.ACTIVE,
    openingHours: { open: '09:00', close: '23:00' },
  },
];

async function seed() {
  try {
    console.log('🌱 Connecting to MongoDB for seeding...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.');

    // 1. Seed/Upsert Categories
    console.log('📌 Seeding Global Cravings & Categories...');
    await Category.deleteMany({ isGlobal: true });
    const createdCategories = await Category.insertMany(seedCategories);
    console.log(`✅ Seeded ${createdCategories.length} categories.`);

    // 2. Seed Vendor Owner User if not present
    let vendorOwner = await User.findOne({ email: 'vendor@goeatone.com' });
    if (!vendorOwner) {
      vendorOwner = await User.create({
        name: 'Master Vendor',
        email: 'vendor@goeatone.com',
        phoneNumber: '+2348000000001',
        password: 'Password123!',
        role: UserRole.VENDOR,
        isVerified: true,
      });
      console.log('👤 Created master vendor user for restaurant ownership.');
    }

    // 3. Seed Restaurants & Food Items
    console.log('📌 Seeding Restaurants & Menu Items...');
    for (const restData of seedRestaurants) {
      let restaurant = await Restaurant.findOne({ name: restData.name });
      if (!restaurant) {
        restaurant = await Restaurant.create({
          ...restData,
          owner: vendorOwner._id,
        });
        console.log(`🏪 Created restaurant: ${restaurant.name}`);
      } else {
        await Restaurant.findByIdAndUpdate(restaurant._id, restData);
        console.log(`🔄 Updated restaurant: ${restaurant.name}`);
      }

      // Seed food items for this restaurant
      await FoodItem.deleteMany({ restaurant: restaurant._id });

      const foodItems = [
        {
          name: `Special Smoky Jollof Bowl - ${restaurant.name}`,
          description: 'Authentic Nigerian Smoky Party Jollof Rice served with Fried Plantain, Coleslaw, and Grilled Chicken.',
          price: 3500,
          image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80',
          category: createdCategories[0]._id,
          restaurant: restaurant._id,
          isAvailable: true,
          prepTime: '20 mins',
        },
        {
          name: `Pounded Yam & Assorted Egusi Soup - ${restaurant.name}`,
          description: 'Fluffy Pounded Yam with rich Egusi soup loaded with Goat meat, Kanda, and Stockfish.',
          price: 4500,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
          category: createdCategories[1]._id,
          restaurant: restaurant._id,
          isAvailable: true,
          prepTime: '25 mins',
        },
        {
          name: `Refuel Crunchy Chicken & Chips - ${restaurant.name}`,
          description: '2 pieces of golden crispy fried chicken with seasoned french fries and ketchup dip.',
          price: 3800,
          image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
          category: createdCategories[2]._id,
          restaurant: restaurant._id,
          isAvailable: true,
          prepTime: '15 mins',
        },
        {
          name: `Loaded Beef Pepperoni Pizza - ${restaurant.name}`,
          description: 'Freshly baked thin-crust pizza loaded with Mozzarella, Beef Pepperoni, and Bell Peppers.',
          price: 6500,
          image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
          category: createdCategories[3]._id,
          restaurant: restaurant._id,
          isAvailable: true,
          prepTime: '25 mins',
        },
      ];

      await FoodItem.insertMany(foodItems);
      console.log(`  🍽️ Seeded 4 menu items for ${restaurant.name}.`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database seeding failed:', err);
    process.exit(1);
  }
}

seed();
