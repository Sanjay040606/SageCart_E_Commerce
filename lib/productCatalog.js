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

const getCatalogPreferenceScore = (product) => {
  let score = 0;
  const source = cleanText(product?.source || product?.datasetMeta?.source || "").toLowerCase();
  const status = cleanText(product?.status).toLowerCase();
  const stock = Number(product?.stock);
  const rating = Number(getProductAverageRating(product) || product?.rating || 0);
  const reviewCount = Number(getProductReviewCount(product) || product?.ratingsCount || 0);

  if (source === "manual") score += 1_000_000;
  if (status === "active") score += 100_000;
  else if (status === "low_stock") score += 80_000;
  else if (status === "out_of_stock") score += 10_000;

  if (Number.isFinite(stock)) {
    score += Math.min(Math.max(stock, 0), 1000);
  }

  if (Number.isFinite(rating)) score += rating * 100;
  if (Number.isFinite(reviewCount)) score += Math.min(reviewCount, 500);
  score += Number.isFinite(Number(product?.discountPercent)) ? Number(product.discountPercent) : 0;
  score += Number.isFinite(Number(product?.date)) ? Number(product.date) / 1e9 : 0;

  return score;
};

const sortCatalogProductsForDedupe = (products = []) =>
  [...products].sort((a, b) => getCatalogPreferenceScore(b) - getCatalogPreferenceScore(a));

export const getProductCatalogKey = (product) => {
  return buildCatalogDuplicateKey(product);
};

export const dedupeCatalogProducts = (products = []) => {
  const seen = new Set();

  return sortCatalogProductsForDedupe(products).filter((product) => {
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
