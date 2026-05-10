import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import { buildStockUpdateOperations } from "../lib/stockSeeder.js";

const DEFAULT_HIGH_STOCK = 500;
const DEFAULT_LOW_STOCK_RANGE = [1, 5];
const BATCH_SIZE = 500;

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const loadEnvFiles = () => {
  const envFiles = [".env.local", ".env"];

  for (const envName of envFiles) {
    const envPath = path.resolve(process.cwd(), envName);
    if (!fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
};

const chunkArray = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const connectDatabase = async () => {
  loadEnvFiles();

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add it to .env or .env.local before seeding.");
  }

  await mongoose.connect(`${process.env.MONGODB_URI}/sagecart`, {
    bufferCommands: false
  });
};

export const main = async () => {
  await connectDatabase();

  try {
    const products = await Product.find({}).lean();

    if (!products.length) {
      console.log("No products found to seed.");
      return;
    }

    const { operations, preview, summary } = buildStockUpdateOperations(products, {
      highStockValue: DEFAULT_HIGH_STOCK,
      lowStockRange: DEFAULT_LOW_STOCK_RANGE
    });

    for (const batch of chunkArray(operations, BATCH_SIZE)) {
      if (batch.length === 0) continue;
      await Product.bulkWrite(batch, { ordered: false });
    }

    console.log(`Seeded stock for ${operations.length} products.`);
    console.log(
      `Targets: high=${summary.targetCounts.high}, low=${summary.targetCounts.low}, zero=${summary.targetCounts.zero}`
    );
    console.log(
      `Assigned: high=${summary.assignedCounts.high}, low=${summary.assignedCounts.low}, zero=${summary.assignedCounts.zero}`
    );
    console.log(`Categories touched: ${summary.categoryCount}`);
    console.log("Preview:");

    preview.forEach((entry, index) => {
      console.log(
        `${index + 1}. ${entry.name} | ${entry.categoryKey} | stock=${entry.stock} | status=${entry.status}`
      );
    });
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (entryFile && currentFile === entryFile) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
