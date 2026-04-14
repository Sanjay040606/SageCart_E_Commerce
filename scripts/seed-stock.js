/**
 * Seed script to populate existing products with stock values
 * Run with: node scripts/seed-stock.js
 * Make sure MongoDB connection string is set in .env.local or process.env.MONGODB_URI
 */

const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Connection Error:', error.message);
    process.exit(1);
  }
};

// Define Product schema (same as app)
const productSchema = new mongoose.Schema({
  userId: { type: String, required: true, ref: "user" },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  offerPrice: { type: Number, required: true },
  image: { type: Array, required: true },
  category: { type: String, required: true },
  promoCode: { type: String, sparse: true, unique: true, uppercase: true, trim: true },
  stock: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock', 'low_stock'],
    default: 'active'
  },
  date: { type: Number, required: true }
});

const Product = mongoose.model('product', productSchema);

const getStatusFromStock = (stock) => {
  if (stock === 0) return 'out_of_stock';
  if (stock <= 5) return 'low_stock';
  return 'active';
};

const seedStock = async () => {
  try {
    const products = await Product.find({});
    console.log(`Found ${products.length} products to update\n`);

    if (products.length === 0) {
      console.log('No products found in database');
      process.exit(0);
    }

    let updated = 0;
    const result = [];

    for (let i = 0; i < products.length; i++) {
      // Reduce pattern: 10 -> 5 -> 0 -> 10 -> 5 -> 0 ...
      let stockValue;
      const pattern = i % 3;
      if (pattern === 0) {
        stockValue = 10;
      } else if (pattern === 1) {
        stockValue = 5;
      } else {
        stockValue = 0;
      }

      const newStatus = getStatusFromStock(stockValue);

      // Update if stock changed
      if (products[i].stock !== stockValue) {
        products[i].stock = stockValue;
        products[i].status = newStatus;
        await products[i].save();
        updated++;

        result.push({
          name: products[i].name,
          stock: stockValue,
          status: newStatus
        });

        console.log(`✓ ${products[i].name}: stock=${stockValue}, status=${newStatus}`);
      }
    }

    console.log(`\n✅ Updated ${updated} products`);
    console.log(`Summary:\n  - 10 stock: ${Math.ceil(products.length / 3)}\n  - 5 stock: ${Math.floor(products.length / 3)}\n  - 0 stock: ${Math.floor(products.length / 3)}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error.message);
    process.exit(1);
  }
};

const main = async () => {
  await connectDB();
  await seedStock();
};

main();
