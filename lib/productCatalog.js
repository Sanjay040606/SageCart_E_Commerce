import { getProductAverageRating, getProductReviewCount } from "@/lib/productDisplay";
import { buildCatalogDuplicateKey } from "./catalogCompaction.js";
import { isCatalogProductVisible } from "./productVariantRules.js";

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const CURATED_HOME_PRODUCT_NAMES = [
  "Samsung Projector 4k",
  "Realme 310 Airpods",
  "Samsung Galaxy S23",
  "PlayStation 5",
  "Apple AirPods Pro 2nd Gen",
  "Bose QuietComfort 45",
  "Garmin Venu 3",
  "PlayStation 5 Slim",
  "Canon EOS R5",
  "JBL SoundBox 110",
  "Sony WH-1000XM5",
  "Apple iPhone 15 Pro",
  "Nintendo Switch OLED",
  "Boat Rockerz 450",
  "Dell Inspiron 14",
  "MacBook Pro 16",
  "ASUS ROG Zephyrus G16",
  "Sony WF-1000XM5",
  "Garmin Venu 2"
];

const normalizeProductName = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const getProductCatalogKey = (product) => {
  return buildCatalogDuplicateKey(product);
};

export const dedupeCatalogProducts = (products = []) => {
  const seen = new Set();

  return products.filter((product) => {
    if (!isCatalogProductVisible(product)) return false;

    const key = getProductCatalogKey(product);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getFeaturedSortRank = (product) => {
  const status = cleanText(product?.status);
  if (status === "active") return 2;
  if (status === "low_stock") return 1;
  return 0;
};

export const compareFeaturedProducts = (a, b) => {
  const statusDiff = getFeaturedSortRank(b) - getFeaturedSortRank(a);
  if (statusDiff !== 0) return statusDiff;

  const ratingDiff = (getProductAverageRating(b) || 0) - (getProductAverageRating(a) || 0);
  if (ratingDiff !== 0) return ratingDiff;

  const reviewDiff = (getProductReviewCount(b) || 0) - (getProductReviewCount(a) || 0);
  if (reviewDiff !== 0) return reviewDiff;

  const discountDiff = Number(b?.discountPercent || 0) - Number(a?.discountPercent || 0);
  if (discountDiff !== 0) return discountDiff;

  return Number(b?.date || 0) - Number(a?.date || 0);
};

export const getFeaturedHomeProducts = (products = [], limit = 6) =>
  dedupeCatalogProducts(products)
    .slice()
    .sort(compareFeaturedProducts)
    .slice(0, limit);

export const getCuratedHomeProducts = (products = [], limit = CURATED_HOME_PRODUCT_NAMES.length) => {
  const deduped = dedupeCatalogProducts(products);
  const lookup = new Map();

  deduped.forEach((product) => {
    const normalizedName = normalizeProductName(product?.name || product?.title || "");
    if (!normalizedName || lookup.has(normalizedName)) return;
    lookup.set(normalizedName, product);
  });

  const curated = CURATED_HOME_PRODUCT_NAMES.map((targetName) => lookup.get(normalizeProductName(targetName))).filter(Boolean);
  return curated.slice(0, limit);
};
