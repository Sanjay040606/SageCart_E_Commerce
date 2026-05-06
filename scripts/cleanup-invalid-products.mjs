import fs from "fs";
import path from "path";
import connectDB from "../config/db.js";
import Product from "../models/Product.js";
import {
  getRenderableCatalogImageCount,
  hasVariantMismatch,
  isCatalogProductVisible
} from "../lib/productVariantRules.js";

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

const args = new Set(process.argv.slice(2));
const shouldDelete = args.has("--delete") || args.has("--apply");

loadEnvFiles();
await connectDB();

const products = await Product.find({}).select("_id name category image colors sizes variantOptions status").lean();
const invalidProducts = products.filter((product) => !isCatalogProductVisible(product));

console.log(`Total products: ${products.length}`);
console.log(`Invalid products: ${invalidProducts.length}`);

for (const product of invalidProducts.slice(0, 20)) {
  const imageCount = getRenderableCatalogImageCount(product);
  const mismatch = hasVariantMismatch(product);
  console.log(
    [
      `- ${product.name || product._id}`,
      `category=${product.category || "-"}`,
      `images=${imageCount}`,
      `colors=${Array.isArray(product.colors) ? product.colors.length : 0}`,
      `sizes=${Array.isArray(product.sizes) ? product.sizes.length : 0}`,
      `variantOptions=${Array.isArray(product.variantOptions) ? product.variantOptions.length : 0}`,
      `mismatch=${mismatch ? "yes" : "no"}`
    ].join(" | ")
  );
}

if (!shouldDelete) {
  console.log("Dry run only. Re-run with --delete to remove these products.");
  process.exit(0);
}

if (invalidProducts.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

const invalidIds = invalidProducts.map((product) => product._id);
const result = await Product.deleteMany({ _id: { $in: invalidIds } });
console.log(`Deleted ${result.deletedCount || 0} invalid products.`);
