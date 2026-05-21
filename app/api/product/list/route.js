import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { dedupeCatalogProducts } from "@/lib/productCatalog";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { getCachedCatalogSnapshot, setCachedCatalogSnapshot } from "@/lib/catalogSnapshot";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
import { buildCatalogListResponse, buildCatalogStats, clampPageSize } from "@/lib/catalogList";

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

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
    categories: buildCatalogStats(catalogProducts).categories
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
    const catalogResponse = buildCatalogListResponse({
      catalogProducts,
      catalogStats,
      searchQuery,
      activeCategory,
      stockFilter,
      ratingFilter,
      priceBand,
      sortBy,
      currentPage,
      pageSize
    });

    return NextResponse.json(
      {
        success: true,
        ...catalogResponse
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
