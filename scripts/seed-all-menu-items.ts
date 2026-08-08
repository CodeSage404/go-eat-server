import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import Restaurant from '../src/models/restaurant.model';
import Category from '../src/models/category.model';
import FoodItem from '../src/models/foodItem.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-eat';

interface MenuItemSeed {
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  calories: number;
}

interface CategorySeed {
  name: string;
  order: number;
  icon?: string;
  image?: string;
  items: MenuItemSeed[];
}

const menuCategoriesSeed: CategorySeed[] = [
  {
    name: 'Popular Dishes',
    order: 1,
    icon: 'Flame',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Smoky Party Jollof Rice Combo',
        description: 'Authentic Nigerian party jollof rice served with grilled peppered chicken, fried plantain (dodo), and coleslaw.',
        price: 5500,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 680,
      },
      {
        name: 'Special Fried Rice & Turkey',
        description: 'Stir-fried basmati rice with mixed vegetables, prawns, and juicy seasoned grilled turkey wing.',
        price: 6500,
        image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        calories: 720,
      },
      {
        name: 'Asun & Pounded Yam Special',
        description: 'Spicy goat meat peppersoup/asun served with soft freshly pounded yam.',
        price: 7000,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 750,
      },
    ],
  },
  {
    name: 'Burgers & Wraps',
    order: 2,
    icon: 'Burger',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Double Cheese Smash Burger',
        description: 'Two smashed beef patties, melted cheddar cheese, caramelized onions, pickles, and special burger sauce on a brioche bun.',
        price: 5000,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        calories: 650,
      },
      {
        name: 'Crispy Chicken Shawarma Wrap',
        description: 'Grilled spiced chicken fillet, Lebanese garlic sauce, cabbage, and sausage wrapped in toasted flatbread.',
        price: 3500,
        image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        calories: 520,
      },
      {
        name: 'Spicy Beef Kofta Wrap',
        description: 'Seasoned minced beef kebab with fresh tomatoes, red onions, and chili garlic tahini.',
        price: 3800,
        image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 490,
      },
    ],
  },
  {
    name: 'Rice & Pasta',
    order: 3,
    icon: 'Utensils',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Seafood Alfredo Pasta',
        description: 'Creamy garlic parmesan fettuccine tossed with sautéed jumbo prawns, squid, and herbs.',
        price: 8500,
        image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281298?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        calories: 810,
      },
      {
        name: 'Spicy Native Jollof (Iwuk Eto)',
        description: 'Traditional palm oil rice cooked with smoked fish, crayfish, scent leaves, and assorted meats.',
        price: 4800,
        image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 640,
      },
      {
        name: 'Spicy Chicken Penne Arrabbiata',
        description: 'Al dente penne pasta in a fiery tomato basil sauce with grilled chicken breast slices.',
        price: 5200,
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 580,
      },
    ],
  },
  {
    name: 'Grills & Shawarma',
    order: 4,
    icon: 'Flame',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Grilled Peppered Croaker Fish',
        description: 'Whole fresh croaker fish marinated in local spices and grilled over open flame, served with yam chips and pepper sauce.',
        price: 12000,
        image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 620,
      },
      {
        name: 'Suya Spiced Chicken Wings (8pcs)',
        description: 'Crispy grilled chicken wings rubbed with authentic northern Yaji suya spice, served with sliced onions.',
        price: 4500,
        image: 'https://images.unsplash.com/photo-1527477247444-e7951d09682a?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 540,
      },
      {
        name: 'Loaded Mixed Meat Suya Platter',
        description: 'Generous platter of beef suya, gizzard, and chicken suya with tomato and onion garnish.',
        price: 9000,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 890,
      },
    ],
  },
  {
    name: 'Sides & Fries',
    order: 5,
    icon: 'Sparkles',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Crispy Golden French Fries',
        description: 'Thick-cut golden potato fries seasoned with sea salt and rosemary.',
        price: 2000,
        image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 350,
      },
      {
        name: 'Sweet Fried Plantain (Dodo)',
        description: 'Ripe golden fried plantain slices, sweet and caramelized.',
        price: 1500,
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 280,
      },
      {
        name: 'Loaded Cheesy Bacon Fries',
        description: 'Crispy fries topped with melted cheddar cheese sauce, beef bacon bits, and jalapeños.',
        price: 3500,
        image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        calories: 510,
      },
    ],
  },
  {
    name: 'Drinks & Beverages',
    order: 6,
    icon: 'Coffee',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Fresh Hibiscus Zobo Infusion',
        description: 'Chilled natural hibiscus tea brewed with ginger, pineapple, and cloves.',
        price: 1500,
        image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 120,
      },
      {
        name: 'Tropical Passionfruit & Peach Iced Tea',
        description: 'Refreshing freshly brewed black tea infused with passionfruit and peach purée.',
        price: 2200,
        image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 140,
      },
      {
        name: 'Classic Chapman Cocktail',
        description: "Nigeria's favorite fruity mocktail with Angostura bitters, citrus slices, and cucumber.",
        price: 2500,
        image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 180,
      },
    ],
  },
  {
    name: 'Desserts & Specials',
    order: 7,
    icon: 'Cake',
    image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Warm Chocolate Molten Lava Cake',
        description: 'Decadent dark chocolate cake with a gooey molten center, served with vanilla ice cream.',
        price: 4000,
        image: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 560,
      },
      {
        name: 'Caramel Biscoff Cheesecake Slice',
        description: 'Rich New York style baked cheesecake layered with Lotus Biscoff spread and biscuit crumbs.',
        price: 4500,
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 480,
      },
      {
        name: 'Fresh Berry Pavlova Bowl',
        description: 'Crisp meringue topped with whipped cream, fresh strawberries, and passionfruit drizzle.',
        price: 3800,
        image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 320,
      },
    ],
  },
  {
    name: 'Breakfast & Brunch',
    order: 8,
    icon: 'Sun',
    image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80',
    items: [
      {
        name: 'Full Nigerian Breakfast Platter',
        description: 'Yam chips or boiled yam, spicy Akara (bean cakes), corn beef sauce, and fried eggs.',
        price: 4500,
        image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 610,
      },
      {
        name: 'Fluffy Buttermilk Pancakes (4pcs)',
        description: 'Golden fluffy pancakes served with maple syrup, berry compote, and whipped butter.',
        price: 3800,
        image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: true,
        isSpicy: false,
        calories: 450,
      },
      {
        name: 'Spicy Egg & Suya Toast',
        description: 'Toasted artisanal sourdough topped with creamy scrambled eggs, suya bits, and chives.',
        price: 3500,
        image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=800&q=80',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: true,
        calories: 410,
      },
    ],
  },
];

async function seedAllRestaurantsMenuItems() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully!');

    const restaurants = await Restaurant.find({});
    console.log(`Found ${restaurants.length} restaurants in the database.`);

    if (restaurants.length === 0) {
      console.log('No restaurants found. Please seed restaurants first!');
      process.exit(0);
    }

    let totalCategoriesCreated = 0;
    let totalItemsCreated = 0;
    let totalItemsUpdated = 0;

    await Promise.all(
      restaurants.map(async (restaurant) => {
        console.log(`Seeding menu items for restaurant: "${restaurant.name}" (${restaurant._id})...`);

        for (const catSeed of menuCategoriesSeed) {
          // Find existing categories for this restaurant or globally
          let existingCategories = await Category.find({
            $or: [{ restaurant: restaurant._id }, { isGlobal: true }]
          });
          
          if (existingCategories.length === 0) {
            console.log(`Skipping categories for ${restaurant.name} because no categories exist and creation is disabled.`);
            continue;
          }

          // Randomly pick an existing category to assign these items to
          const randomCategory = existingCategories[Math.floor(Math.random() * existingCategories.length)];
          let category = randomCategory;

          // Parallelize food item seeding within this category
          await Promise.all(
            catSeed.items.map(async (itemSeed) => {
              let item = await FoodItem.findOne({
                name: itemSeed.name,
                restaurant: restaurant._id,
              });

              if (item) {
                item.description = itemSeed.description;
                item.price = itemSeed.price;
                item.image = itemSeed.image;
                item.category = category._id as mongoose.Types.ObjectId;
                item.isAvailable = itemSeed.isAvailable;
                item.isVegetarian = itemSeed.isVegetarian;
                item.isSpicy = itemSeed.isSpicy;
                item.calories = itemSeed.calories;
                await item.save();
                totalItemsUpdated++;
              } else {
                await FoodItem.create({
                  name: itemSeed.name,
                  description: itemSeed.description,
                  price: itemSeed.price,
                  image: itemSeed.image,
                  category: category._id,
                  restaurant: restaurant._id,
                  isAvailable: itemSeed.isAvailable,
                  isVegetarian: itemSeed.isVegetarian,
                  isSpicy: itemSeed.isSpicy,
                  calories: itemSeed.calories,
                });
                totalItemsCreated++;
              }
            })
          );
        }
      })
    );

    console.log('\n========================================');
    console.log('✅ Menu seeding completed successfully!');
    console.log(`Restaurants processed: ${restaurants.length}`);
    console.log(`New Categories created: ${totalCategoriesCreated}`);
    console.log(`New Menu Items created: ${totalItemsCreated}`);
    console.log(`Existing Menu Items updated: ${totalItemsUpdated}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Error seeding menu items:', err);
    process.exit(1);
  }
}

seedAllRestaurantsMenuItems();
