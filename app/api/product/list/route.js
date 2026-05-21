import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { dedupeCatalogProducts } from "@/lib/productCatalog";
import { convertUSDToINR } from "@/lib/currencyUtils";
import { getCachedCatalogSnapshot, setCachedCatalogSnapshot } from "@/lib/catalogSnapshot";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import {
  buildProductSearchTokens,
  getPrimarySearchFamily,
  getProductSearchScore,
  matchesSearchTokens,
  normalizeSearchText,
  prepareSearchQuery
} from "@/lib/productSearch";
import { isCatalogProductVisible } from "@/lib/productVariantRules";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const clampPageSize = (value) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, parsePositiveInteger(value, DEFAULT_PAGE_SIZE)));

const matchesPriceBand = (priceInr, priceBand) => {
  switch (priceBand) {
    case "under-2000":
      return priceInr < 2000;
    case "2000-5000":
      return priceInr >= 2000 && priceInr < 5000;
    case "5000-10000":
      return priceInr >= 5000 && priceInr < 10000;
    case "above-10000":
      return priceInr >= 10000;
    default:
      return true;
  }
};

const matchesRating = (rating, ratingFilter) => {
  switch (ratingFilter) {
    case "4":
      return rating >= 4;
    case "3":
      return rating >= 3;
    case "2":
      return rating >= 2;
    default:
      return true;
  }
};

const matchesStock = (status, stockFilter) => {
  switch (stockFilter) {
    case "in_stock":
      return status === "active" || status === "low_stock";
    case "low_stock":
      return status === "low_stock";
    case "out_of_stock":
      return status === "out_of_stock";
    default:
      return true;
  }
};

const buildCategoryList = (products = []) =>
  Array.from(
    new Set(
      products
        .map((product) => normalizeText(product?.category))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

const toCatalogListProduct = (product = {}) => {
  const datasetMeta = product?.datasetMeta && typeof product.datasetMeta === "object" ? product.datasetMeta : {};
  const rating = Number.isFinite(Number(product?.rating ?? datasetMeta.rating))
    ? Number(product?.rating ?? datasetMeta.rating)
    : null;
  const ratingsCount = Number.isFinite(Number(product?.ratingsCount ?? datasetMeta.ratingsCount))
    ? Number(product?.ratingsCount ?? datasetMeta.ratingsCount)
    : 0;

  return {
    _id: product?._id,
    source: product?.source,
    sourceId: product?.sourceId,
    userId: product?.userId,
    name: product?.name,
    description: product?.description,
    price: product?.price,
    offerPrice: product?.offerPrice,
    image: Array.isArray(product?.image) ? product.image : [],
    category: product?.category,
    promoCode: product?.promoCode,
    stock: Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 0,
    status: product?.status,
    colors: Array.isArray(product?.colors) ? product.colors : [],
    sizes: Array.isArray(product?.sizes) ? product.sizes : [],
    variantMode: product?.variantMode,
    date: product?.date,
    brand: product?.brand ?? datasetMeta.brand ?? "",
    slug: product?.slug ?? datasetMeta.slug ?? "",
    rating,
    ratingsCount,
    discountPercent: Number.isFinite(Number(product?.discountPercent ?? datasetMeta.discountPercent))
      ? Number(product?.discountPercent ?? datasetMeta.discountPercent)
      : 0,
    sellerName: product?.sellerName ?? datasetMeta.sellerName ?? "",
    datasetMeta: {
      brand: datasetMeta.brand ?? "",
      slug: datasetMeta.slug ?? "",
      rating,
      ratingsCount,
      discountPercent: Number.isFinite(Number(datasetMeta.discountPercent)) ? Number(datasetMeta.discountPercent) : 0,
      sellerName: datasetMeta.sellerName ?? ""
    }
  };
};

const getCatalogSnapshot = async () => {
  const cachedSnapshot = getCachedCatalogSnapshot();
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  const rawProducts = await Product.aggregate(buildCatalogSummaryPipeline());
  const visibleProducts = rawProducts.filter(isCatalogProductVisible);
  const catalogProducts = dedupeCatalogProducts(visibleProducts);
  const catalogStats = {
    totalProducts: catalogProducts.length,
    categories: buildCategoryList(catalogProducts)
  };

  const snapshot = {
    catalogProducts,
    catalogStats
  };

  setCachedCatalogSnapshot(snapshot);

  return snapshot;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = normalizeText(searchParams.get("search") || searchParams.get("q") || "");
    const activeCategory = normalizeText(searchParams.get("category") || "all") || "all";
    const stockFilter = normalizeText(searchParams.get("stock") || "all") || "all";
    const ratingFilter = normalizeText(searchParams.get("rating") || "all") || "all";
    const priceBand = normalizeText(searchParams.get("price") || "all") || "all";
    const sortBy = normalizeText(searchParams.get("sort") || "featured") || "featured";
    const currentPage = parsePositiveInteger(searchParams.get("page"), 1);
    const pageSize = clampPageSize(searchParams.get("limit"));

    await connectDB();

    const { catalogProducts, catalogStats } = await getCatalogSnapshot();

    const preparedSearchQuery = prepareSearchQuery(searchQuery);
    const query = preparedSearchQuery.normalizedQuery;

    const filteredProducts = query
      ? catalogProducts
          .map((product) => {
            const priceInr = convertUSDToINR(product.offerPrice);
            const rating = Number.isFinite(Number(product?.datasetMeta?.rating ?? product?.rating))
              ? Number(product?.datasetMeta?.rating ?? product?.rating)
              : 0;
            const searchTokens = buildProductSearchTokens(product);
            const nameText = normalizeSearchText(product?.name ?? product?.title);
            const categoryText = normalizeSearchText(product?.category);
            const brandText = normalizeSearchText(product?.brand ?? product?.datasetMeta?.brand);
            const slugText = normalizeSearchText(product?.slug ?? product?.datasetMeta?.slug);
            const availabilityStatus = String(product?.status || "").trim().toLowerCase();
            const availabilityStock = Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 0;

            return {
              product,
              searchTokens,
              searchFamily: getPrimarySearchFamily(searchTokens),
              nameText,
              categoryText,
              brandText,
              slugText,
              priceInr,
              rating,
              status: availabilityStatus,
              stock: availabilityStock,
              discountPercent: Number(product.discountPercent || 0),
              dateValue: Number(product.date || 0)
            };
          })
          .filter(({ product, searchTokens, searchFamily, nameText, categoryText, brandText, slugText, priceInr, rating, status }) => {
            const matchesSearch = matchesSearchTokens(searchTokens, query, preparedSearchQuery);
            const matchesCategory = activeCategory === "all" || normalizeText(product.category) === activeCategory;
            const matchesSearchFamily =
              !preparedSearchQuery.queryFamily
              || searchFamily === preparedSearchQuery.queryFamily
              || nameText === query
              || categoryText === query
              || brandText === query
              || slugText === query;

            return (
              matchesSearch &&
              matchesCategory &&
              matchesSearchFamily &&
              matchesPriceBand(priceInr, priceBand) &&
              matchesRating(rating, ratingFilter) &&
              matchesStock(status, stockFilter)
            );
          })
          .map((item) => ({
            ...item,
            searchScore: getProductSearchScore(item.product, query, item, preparedSearchQuery)
          }))
      : catalogProducts
          .map((product) => ({
            product,
            priceInr: convertUSDToINR(product.offerPrice),
            rating: Number.isFinite(Number(product?.datasetMeta?.rating ?? product?.rating))
              ? Number(product?.datasetMeta?.rating ?? product?.rating)
              : 0,
            status: String(product?.status || "").trim().toLowerCase(),
            stock: Number.isFinite(Number(product?.stock)) ? Number(product.stock) : 0,
            discountPercent: Number(product.discountPercent || 0),
            dateValue: Number(product.date || 0)
          }))
          .filter(({ product, priceInr, rating, status }) => {
            const matchesCategory = activeCategory === "all" || normalizeText(product.category) === activeCategory;

            return (
              matchesCategory &&
              matchesPriceBand(priceInr, priceBand) &&
              matchesRating(rating, ratingFilter) &&
              matchesStock(status, stockFilter)
            );
          });

    const compareBySort = (a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.priceInr - b.priceInr;
        case "price-high":
          return b.priceInr - a.priceInr;
        case "rating-high":
          return b.rating - a.rating;
        case "discount-high":
          return b.discountPercent - a.discountPercent;
        case "stock-high":
          return b.stock - a.stock;
        case "newest":
          return b.dateValue - a.dateValue;
        default:
          return 0;
      }
    };

    const sortedProducts = [...filteredProducts];
    if (query) {
      sortedProducts.sort((a, b) => {
        const relevanceDiff = b.searchScore - a.searchScore;
        if (relevanceDiff !== 0) return relevanceDiff;
        return compareBySort(a, b);
      });
    } else {
      sortedProducts.sort(compareBySort);
    }

    const totalProducts = sortedProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = totalProducts === 0 ? 0 : (safePage - 1) * pageSize;
    const endIndex = totalProducts === 0 ? 0 : Math.min(startIndex + pageSize, totalProducts);
    const pagedProducts = sortedProducts.slice(startIndex, endIndex).map(({ product }) => toCatalogListProduct(product));

    return NextResponse.json(
      {
        success: true,
        products: pagedProducts,
        pagination: {
          page: safePage,
          limit: pageSize,
          total: totalProducts,
          totalPages,
          hasPrevious: safePage > 1,
          hasNext: safePage < totalPages,
          start: totalProducts === 0 ? 0 : startIndex + 1,
          end: endIndex
        },
        catalogStats
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
