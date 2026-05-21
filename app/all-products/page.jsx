import connectDB from "@/config/db";
import Product from "@/models/Product";
import { dedupeCatalogProducts } from "@/lib/productCatalog";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { getCachedCatalogSnapshot, setCachedCatalogSnapshot } from "@/lib/catalogSnapshot";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
import { buildCatalogListResponse } from "@/lib/catalogList";
import AllProductsClient from "@/components/AllProductsClient";

const PRODUCTS_PER_PAGE = 20;

const EMPTY_CATALOG_RESPONSE = {
  products: [],
  pagination: {
    page: 1,
    limit: PRODUCTS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
    start: 0,
    end: 0
  },
  catalogStats: {
    totalProducts: 0,
    categories: []
  }
};

const parseParam = (value, fallback = "") => {
  if (Array.isArray(value)) {
    return parseParam(value[0], fallback);
  }

  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const parsePageParam = (value) => {
  const parsed = Number.parseInt(parseParam(value, "1"), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const readInitialUrlState = (searchParams = {}) => ({
  searchQuery: parseParam(searchParams.search || searchParams.q, ""),
  activeCategory: parseParam(searchParams.category, "all"),
  stockFilter: parseParam(searchParams.stock, "all"),
  ratingFilter: parseParam(searchParams.rating, "all"),
  priceBand: parseParam(searchParams.price, "all"),
  sortBy: parseParam(searchParams.sort, "featured"),
  currentPage: parsePageParam(searchParams.page)
});

const buildCatalogStats = (catalogProducts = []) => ({
  totalProducts: catalogProducts.length,
  categories: Array.from(
    new Set(
      catalogProducts
        .map((product) => String(product?.category ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b))
});

const buildInitialCatalogResponseFromSnapshot = (snapshot, urlState) => {
  const catalogProducts = Array.isArray(snapshot?.catalogProducts) ? snapshot.catalogProducts : [];
  return buildCatalogListResponse({
    catalogProducts,
    catalogStats: snapshot?.catalogStats,
    searchQuery: urlState.searchQuery,
    activeCategory: urlState.activeCategory,
    stockFilter: urlState.stockFilter,
    ratingFilter: urlState.ratingFilter,
    priceBand: urlState.priceBand,
    sortBy: urlState.sortBy,
    currentPage: urlState.currentPage,
    pageSize: PRODUCTS_PER_PAGE
  });
};

const buildCatalogSnapshotFromDatabase = async () => {
  await connectDB();

  const rawProducts = await Product.aggregate(buildCatalogSummaryPipeline());
  const visibleProducts = rawProducts.filter(isCatalogProductVisible);
  const catalogProducts = dedupeCatalogProducts(visibleProducts);
  const snapshot = {
    catalogProducts,
    catalogStats: buildCatalogStats(catalogProducts)
  };

  setCachedCatalogSnapshot(snapshot);

  return snapshot;
};

export default async function AllProductsPage({ searchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams || {});
  const initialUrlState = readInitialUrlState(resolvedSearchParams);
  let initialCatalogResponse = EMPTY_CATALOG_RESPONSE;

  const cachedSnapshot = getCachedCatalogSnapshot();
  if (cachedSnapshot?.catalogProducts?.length > 0) {
    initialCatalogResponse = buildInitialCatalogResponseFromSnapshot(cachedSnapshot, initialUrlState);
  } else {
    const dbSnapshot = await buildCatalogSnapshotFromDatabase();
    initialCatalogResponse = buildInitialCatalogResponseFromSnapshot(dbSnapshot, initialUrlState);
  }

  return (
    <AllProductsClient
      initialCatalogResponse={initialCatalogResponse}
      initialCatalogReady={true}
      searchParams={resolvedSearchParams}
    />
  );
}
