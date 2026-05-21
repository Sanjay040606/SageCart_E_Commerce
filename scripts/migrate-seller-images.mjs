import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Product from "../models/Product.js";

const CLOUDINARY_PRODUCT_FOLDER = process.env.CLOUDINARY_PRODUCT_FOLDER?.trim() || "sagecart";

const cleanText = (value) => String(value ?? "").trim();

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
      const normalizedKey = key.trim();
      const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");

      if (!process.env[normalizedKey]) {
        process.env[normalizedKey] = value;
      }
    }
  }
};

const connectDatabase = async () => {
  loadEnvFiles();

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add it to .env or .env.local before migrating images.");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  await mongoose.connect(`${process.env.MONGODB_URI}/sagecart`, {
    bufferCommands: false
  });
};

const isLegacyCloudinaryUrl = (value) => {
  const url = cleanText(value);
  return Boolean(url) && /res\.cloudinary\.com/i.test(url) && !url.includes(`/${CLOUDINARY_PRODUCT_FOLDER}/`);
};

const uploadImageToFolder = async (value, cache) => {
  const url = cleanText(value);
  if (!isLegacyCloudinaryUrl(url)) return url;

  if (cache.has(url)) {
    return cache.get(url);
  }

  const result = await cloudinary.uploader.upload(url, {
    folder: CLOUDINARY_PRODUCT_FOLDER,
    resource_type: "image"
  });

  const nextUrl = cleanText(result?.secure_url || url);
  cache.set(url, nextUrl);
  return nextUrl;
};

const migrateImageField = async (value, cache) => {
  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = [];

    for (const entry of value) {
      const migrated = await uploadImageToFolder(entry, cache);
      if (migrated !== entry) changed = true;
      nextValue.push(migrated);
    }

    return { value: nextValue, changed };
  }

  if (typeof value === "string") {
    const migrated = await uploadImageToFolder(value, cache);
    return { value: migrated, changed: migrated !== value };
  }

  return { value, changed: false };
};

const migrateVariantOptionArray = async (value, cache) => {
  if (!Array.isArray(value)) {
    return { value, changed: false };
  }

  let changed = false;
  const nextValue = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      nextValue.push(entry);
      continue;
    }

    const nextEntry = { ...entry };
    let entryChanged = false;

    for (const field of ["image", "images"]) {
      if (!(field in nextEntry)) continue;
      const migrated = await migrateImageField(nextEntry[field], cache);
      if (migrated.changed) {
        nextEntry[field] = migrated.value;
        entryChanged = true;
      }
    }

    for (const field of ["imageUrl", "thumbnail", "variantImage"]) {
      if (!(field in nextEntry) || !nextEntry[field]) continue;
      const migrated = await uploadImageToFolder(nextEntry[field], cache);
      if (migrated !== nextEntry[field]) {
        nextEntry[field] = migrated;
        entryChanged = true;
      }
    }

    if (entryChanged) changed = true;
    nextValue.push(nextEntry);
  }

  return { value: nextValue, changed };
};

const buildProductPatch = async (product, cache) => {
  const patch = {};
  let changed = false;

  const imageMigration = await migrateImageField(product?.image, cache);
  if (imageMigration.changed) {
    patch.image = imageMigration.value;
    changed = true;
  }

  const variantOptionsMigration = await migrateVariantOptionArray(product?.variantOptions, cache);
  if (variantOptionsMigration.changed) {
    patch.variantOptions = variantOptionsMigration.value;
    changed = true;
  }

  const variationsMigration = await migrateVariantOptionArray(product?.variations, cache);
  if (variationsMigration.changed) {
    patch.variations = variationsMigration.value;
    changed = true;
  }

  if (product?.datasetMeta && typeof product.datasetMeta === "object" && !Array.isArray(product.datasetMeta)) {
    const datasetMeta = { ...product.datasetMeta };
    let datasetChanged = false;

    const datasetVariantOptionsMigration = await migrateVariantOptionArray(datasetMeta.variantOptions, cache);
    if (datasetVariantOptionsMigration.changed) {
      datasetMeta.variantOptions = datasetVariantOptionsMigration.value;
      datasetChanged = true;
    }

    const datasetVariationsMigration = await migrateVariantOptionArray(datasetMeta.variations, cache);
    if (datasetVariationsMigration.changed) {
      datasetMeta.variations = datasetVariationsMigration.value;
      datasetChanged = true;
    }

    const datasetImageMigration = await migrateImageField(datasetMeta.image, cache);
    if (datasetImageMigration.changed) {
      datasetMeta.image = datasetImageMigration.value;
      datasetChanged = true;
    }

    if (datasetChanged) {
      patch.datasetMeta = datasetMeta;
      changed = true;
    }
  }

  return { patch, changed };
};

export const main = async () => {
  await connectDatabase();

  try {
    const products = await Product.find({
      $or: [
        { source: "manual" },
        { "datasetMeta.source": "manual" }
      ]
    }).lean();

    if (!products.length) {
      console.log("No manual seller products found to migrate.");
      return;
    }

    const uploadCache = new Map();
    let migratedProducts = 0;
    let migratedImages = 0;

    for (const product of products) {
      const { patch, changed } = await buildProductPatch(product, uploadCache);
      if (!changed) continue;

      await Product.updateOne({ _id: product._id }, { $set: patch });
      migratedProducts += 1;
      migratedImages = uploadCache.size;
      console.log(`Migrated images for ${cleanText(product.name) || product._id}`);
    }

    console.log(`Migration complete. Products updated: ${migratedProducts}. Unique images moved: ${migratedImages}.`);
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
