import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Product from "../models/Product.js";
import { buildSeedProducts } from "../lib/productSeedCatalog.js";

const loadEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const main = async () => {
  try {
    loadEnvFile();
    await connectDB();

    const seedUserId = process.env.SEED_PRODUCT_USER_ID || "seed-product-user";
    const products = buildSeedProducts(seedUserId);

    let processed = 0;
    for (const productData of products) {
      const { userId, ...seedFields } = productData;
      const hasPromoCode = Boolean(seedFields.promoCode);
      const update = {
        $set: {
          ...seedFields,
          userId
        }
      };

      if (!hasPromoCode) {
        delete update.$set.promoCode;
        update.$unset = { promoCode: "" };
      }

      await Product.findOneAndUpdate(
        { userId, name: seedFields.name },
        update,
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );
      processed += 1;
      console.log(`Seeded ${seedFields.name}`);
    }

    console.log(`Completed. Seeded or updated ${processed} products.`);
    await mongoose.disconnect();
  } catch (error) {
    console.error("Seed failed:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

main();
