import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import Restaurant from '../models/restaurant.model';
import Category from '../models/category.model';
import FoodItem from '../models/foodItem.model';

const MOCK_ITEMS = [
  {
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheese, lettuce, and tomato.',
    price: 3500,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
    categoryName: 'Mains',
  },
  {
    name: 'Spicy Chicken Wings',
    description: 'Crispy wings tossed in our signature spicy sauce.',
    price: 2500,
    image: 'https://images.unsplash.com/photo-1569691899455-88464f6d3338?auto=format&fit=crop&q=80&w=800',
    categoryName: 'Appetizers',
  },
  {
    name: 'Margherita Pizza',
    description: 'Classic pizza with fresh mozzarella, tomatoes, and basil.',
    price: 4500,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=800',
    categoryName: 'Mains',
  },
  {
    name: 'Caesar Salad',
    description: 'Crisp romaine lettuce with parmesan, croutons, and Caesar dressing.',
    price: 2000,
    image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=800',
    categoryName: 'Sides',
  },
  {
    name: 'Chocolate Lava Cake',
    description: 'Warm chocolate cake with a gooey center.',
    price: 3000,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800',
    categoryName: 'Desserts',
  },
  {
    name: 'Fresh Lemonade',
    description: 'Freshly squeezed lemons with a touch of mint.',
    price: 1500,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800',
    categoryName: 'Drinks',
  },
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/goeat';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    
    await mongoose.connect(mongoUri);
    console.log('Connected to Database successfully.');

    // Get all restaurants
    const restaurants = await Restaurant.find();
    console.log(`Found ${restaurants.length} restaurants to seed.`);

    let itemsSeeded = 0;

    for (const restaurant of restaurants) {
      console.log(`\nSeeding restaurant: ${restaurant.name} (${restaurant._id})`);
      
      for (const mockItem of MOCK_ITEMS) {
        // Find or create category for this restaurant
        let category = await Category.findOne({ 
          name: mockItem.categoryName, 
          $or: [
            { restaurant: restaurant._id },
            { isGlobal: true }
          ]
        });

        if (!category) {
          category = await Category.create({
            name: mockItem.categoryName,
            isGlobal: false,
            restaurant: restaurant._id,
            isActive: true,
          });
          console.log(`  Created category: ${mockItem.categoryName}`);
        }

        // Check if item already exists to avoid duplicates
        const existingItem = await FoodItem.findOne({
          name: mockItem.name,
          restaurant: restaurant._id
        });

        if (!existingItem) {
          await FoodItem.create({
            name: mockItem.name,
            description: mockItem.description,
            price: mockItem.price,
            image: mockItem.image,
            category: category._id,
            restaurant: restaurant._id,
            isAvailable: true,
          });
          itemsSeeded++;
          console.log(`  Added item: ${mockItem.name}`);
        } else {
          console.log(`  Skipped existing item: ${mockItem.name}`);
        }
      }
    }

    console.log(`\nSeeding complete! Added ${itemsSeeded} items.`);

  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from Database.');
    process.exit(0);
  }
}

seedDatabase();
