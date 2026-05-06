import fs from "fs";
import path from "path";
import { convertFlipkartRows } from "../lib/flipkartDataset.js";

const INPUT_PATH = path.resolve(process.cwd(), "public/flipkart_dataset/flipkart_fashion_products_dataset.json");
const OUTPUT_PATH = path.resolve(process.cwd(), "public/flipkart_dataset/sagecart_products.json");

const main = () => {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Dataset not found: ${INPUT_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Flipkart dataset does not contain any rows.");
  }

  const converted = convertFlipkartRows(raw, {
    userId: process.env.SEED_PRODUCT_USER_ID || "seed-product-user"
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(converted, null, 2));

  const categoryCounts = converted.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => `${category}: ${count}`);

  console.log(`Grouped ${raw.length} Flipkart rows into ${converted.length} SageCart products.`);
  console.log(`Output written to ${OUTPUT_PATH}`);
  console.log(`Top categories: ${topCategories.join(", ")}`);
  console.log("Sample products:");
  converted.slice(0, 5).forEach((product, index) => {
    console.log(
      `${index + 1}. ${product.name} | ${product.category} | variants ${product.variantCount || 0} | ${product.price} -> ${product.offerPrice}`
    );
  });
};

main();

