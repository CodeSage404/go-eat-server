import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import Category from '../src/models/category.model';
import FoodItem from '../src/models/foodItem.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';

async function removeCategories() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully!');

    const categoriesToRemove = [
      'Popular Dishes',
      'Burgers & Wraps',
      'Rice & Pasta',
      'Sides & Fries',
      'Grills & Shawarma',
      'Drinks & Beverages',
      'Desserts & Specials',
      'Breakfast & Brunch',
    ];

    console.log(`Finding categories to remove: ${categoriesToRemove.join(', ')}`);
    
    const categories = await Category.find({ name: { $in: categoriesToRemove } });
    
    if (categories.length === 0) {
      console.log('No matching categories found.');
    } else {
      const categoryIds = categories.map(c => c._id);
      
      console.log(`Found ${categories.length} categories. Removing them...`);
      const deleteCatResult = await Category.deleteMany({ _id: { $in: categoryIds } });
      console.log(`Deleted ${deleteCatResult.deletedCount} categories.`);
      
      // Also remove the food items that belong to these categories to prevent orphans
      console.log('Removing associated food items...');
      const deleteFoodResult = await FoodItem.deleteMany({ category: { $in: categoryIds } });
      console.log(`Deleted ${deleteFoodResult.deletedCount} associated food items.`);
    }

    console.log('✨ Deletion completed successfully! ✨');
  } catch (error) {
    console.error('❌ Error removing categories:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Mongoose connection closed.');
    process.exit(0);
  }
}

removeCategories();
