import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Product from "../models/Product.js";
import {
  buildDatasetReviewCards,
  buildProductVariantOptions,
  getDatasetReviewHighlights,
  normalizeProductImages
} from "../lib/productDisplay.js";

const DATASET_PATH = path.resolve(process.cwd(), "public/products_dataset/marketplace_products.json");
const LOW_STOCK_THRESHOLD = 5;
const BULK_BATCH_SIZE = 500;
const SOURCES_TO_REMOVE = [
  "marketplace-dataset",
  "amazon-dataset",
  "lazada-dataset"
];

const getProductStatusFromStock = (stock) => {
  if (stock === 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "active";
};

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

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const resolvePricing = (priceValue, offerValue) => {
  const price = Number(priceValue);
  const offer = Number(offerValue);

  if (Number.isFinite(price) && price > 0 && Number.isFinite(offer) && offer > 0) {
    return {
      priceInr: Math.max(price, offer),
      offerPriceInr: Math.min(price, offer)
    };
  }

  if (Number.isFinite(price) && price > 0) {
    return {
      priceInr: price,
      offerPriceInr: price
    };
  }

  if (Number.isFinite(offer) && offer > 0) {
    return {
      priceInr: offer,
      offerPriceInr: offer
    };
  }

  return null;
};

const buildDatasetMeta = (item) => {
  const sourcePrice = toNumber(item.price, 0);
  const sourceOfferPrice = toNumber(item.offerPrice, 0);
  const baseVariantOptions = buildProductVariantOptions(item);
  const variantOptions = baseVariantOptions.map((option) => ({
    ...option,
    priceInr: (() => {
      const variantPrice = Number(option.priceInr);
      return Number.isFinite(variantPrice) && variantPrice > 0 ? variantPrice : sourceOfferPrice;
    })(),
    originalPriceInr: (() => {
      const originalPrice = Number(option.originalPriceInr ?? sourcePrice);
      return Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : sourcePrice;
    })()
  }));

  return {
    source: cleanText(item.source) || "marketplace-dataset",
    sourceOrigin: cleanText(item.sourceOrigin) || cleanText(item.datasetMeta?.sourceOrigin) || "marketplace",
    sourceId: cleanText(item.sourceId),
    brand: cleanText(item.brand),
    title: cleanText(item.title),
    currency: cleanText(item.currency) || "USD",
    categorySlug: cleanText(item.categorySlug),
    slug: cleanText(item.slug),
    rating: item.rating ?? null,
    ratingsCount: toNumber(item.ratingsCount, 0),
    discountPercent: toNumber(item.discountPercent, 0),
    sourcePrice,
    sourceOfferPrice,
    sourceCurrency: cleanText(item.currency) || "USD",
    deliveryOptions: toArray(item.deliveryOptions),
    breadcrumbs: toArray(item.breadcrumbs),
    productDetails: item.productDetails || {},
    productSpecifications: toArray(item.productSpecifications),
    sellerName: cleanText(item.sellerName),
    sellerInformation: item.sellerInformation ?? null,
    sizes: toArray(item.sizes),
    videos: toArray(item.videos),
    variations: toArray(item.variations),
    whatCustomersSaid: item.whatCustomersSaid || item.reviewHighlights || "",
    reviewHighlights: getDatasetReviewHighlights(item),
    variantOptions,
    bestOffer: item.bestOffer || {},
    moreOffers: toArray(item.moreOffers),
    marketplaceSources: toArray(item.datasetMeta?.marketplaceSources || item.marketplaceSources)
  };
};

const buildProductDoc = (item, userId, index) => {
  const source = cleanText(item.source) || "marketplace-dataset";
  const sourceId = cleanText(item.sourceId);
  const name = cleanText(item.name);
  const description = cleanText(item.description);
  const image = normalizeProductImages(item.image);
  const category = cleanText(item.category) || "General";
  const pricing = resolvePricing(item.price, item.offerPrice);
  const stock = Math.max(0, toNumber(item.stock, 0));

  if (!sourceId) {
    throw new Error(`Missing sourceId for dataset row ${index + 1}`);
  }
  if (!name) {
    throw new Error(`Missing name for dataset row ${index + 1}`);
  }
  if (!description) {
    throw new Error(`Missing description for dataset row ${index + 1}`);
  }
  if (image.length === 0) {
    throw new Error(`Missing image for dataset row ${index + 1}`);
  }
  if (!pricing) {
    return null;
  }

  return {
    source,
    sourceId,
    userId,
    name,
    description,
    price: pricing.priceInr,
    offerPrice: pricing.offerPriceInr,
    image,
    category,
    stock,
    status: getProductStatusFromStock(stock),
    colors: Array.isArray(item.colors) ? item.colors.filter(Boolean) : [],
    reviews: buildDatasetReviewCards(item),
    date: toNumber(item.date, Date.now() - index * 86400000),
    datasetMeta: buildDatasetMeta(item)
  };
};

const main = async () => {
  try {
    loadEnvFiles();

    if (!fs.existsSync(DATASET_PATH)) {
      throw new Error(`Mapped marketplace dataset not found at ${DATASET_PATH}`);
    }

    const raw = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("Mapped marketplace dataset is empty.");
    }

    await connectDB();

    const removed = await Product.deleteMany({ source: { $in: SOURCES_TO_REMOVE } });
    console.log(`Removed ${removed.deletedCount || 0} existing marketplace products before reseeding.`);

    const seedUserId = process.env.SEED_PRODUCT_USER_ID || "seed-product-user";
    const preview = [];
    let processed = 0;
    let upserted = 0;
    let matched = 0;
    let modified = 0;
    let skipped = 0;

    for (let offset = 0; offset < raw.length; offset += BULK_BATCH_SIZE) {
      const batch = raw.slice(offset, offset + BULK_BATCH_SIZE);
      const operations = [];

      batch.forEach((item, batchIndex) => {
        const product = buildProductDoc(item, seedUserId, offset + batchIndex);

        if (!product) {
          skipped += 1;
          return;
        }

        operations.push({
          updateOne: {
            filter: { source: product.source, sourceId: product.sourceId },
            update: {
              $set: product
            },
            upsert: true
          }
        });

        if (preview.length < 5) {
          preview.push(product);
        }
      });

      if (operations.length === 0) {
        processed += batch.length;
        continue;
      }

      const result = await Product.bulkWrite(operations, { ordered: false });
      processed += batch.length;
      upserted += result.upsertedCount || 0;
      matched += result.matchedCount || 0;
      modified += result.modifiedCount || 0;
    }

    const categoryCounts = raw.reduce((acc, item) => {
      const category = cleanText(item.category) || "General";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, count]) => `${category}: ${count}`);

    console.log(`Imported ${raw.length} marketplace products into SageCart.`);
    console.log(`Processed: ${processed}, skipped: ${skipped}, matched: ${matched}, modified: ${modified}, upserted: ${upserted}`);
    console.log(`Top categories: ${topCategories.join(", ")}`);
    console.log("Preview:");
    preview.forEach((product, index) => {
      console.log(
        `${index + 1}. ${product.name} | ${product.category} | stored ${product.price}/${product.offerPrice} | source ${product.datasetMeta.sourceCurrency}`
      );
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error("Dataset import failed:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

main();
