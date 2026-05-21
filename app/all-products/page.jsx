import connectDB from "@/config/db";
import Product from "@/models/Product";
import { dedupeCatalogProducts } from "@/lib/productCatalog";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { getCachedCatalogSnapshot, setCachedCatalogSnapshot } from "@/lib/catalogSnapshot";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
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

const isDefaultCatalogState = (state) =>
  state.searchQuery === "" &&
  state.activeCategory === "all" &&
  state.stockFilter === "all" &&
  state.ratingFilter === "all" &&
  state.priceBand === "all" &&
  state.sortBy === "featured" &&
  state.currentPage === 1;

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

const buildInitialCatalogResponseFromProducts = (catalogProducts = []) => {
  const totalProducts = catalogProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PRODUCTS_PER_PAGE));
  const pagedProducts = catalogProducts.slice(0, PRODUCTS_PER_PAGE);

  return {
    products: pagedProducts,
    pagination: {
      page: 1,
      limit: PRODUCTS_PER_PAGE,
      total: totalProducts,
      totalPages,
      hasPrevious: false,
      hasNext: totalPages > 1,
      start: totalProducts === 0 ? 0 : 1,
      end: pagedProducts.length
    },
    catalogStats: buildCatalogStats(catalogProducts)
  };
};

const buildInitialCatalogResponseFromSnapshot = (snapshot) => {
  const catalogProducts = Array.isArray(snapshot?.catalogProducts) ? snapshot.catalogProducts : [];
  return buildInitialCatalogResponseFromProducts(catalogProducts);
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
  const shouldHydrateCatalog = isDefaultCatalogState(initialUrlState);

  let initialCatalogResponse = EMPTY_CATALOG_RESPONSE;

  if (shouldHydrateCatalog) {
    const cachedSnapshot = getCachedCatalogSnapshot();
    if (cachedSnapshot?.catalogProducts?.length > 0) {
      initialCatalogResponse = buildInitialCatalogResponseFromSnapshot(cachedSnapshot);
    } else {
      const dbSnapshot = await buildCatalogSnapshotFromDatabase();
      initialCatalogResponse = buildInitialCatalogResponseFromSnapshot(dbSnapshot);
    }
  }

  return (
    <AllProductsClient
      initialCatalogResponse={initialCatalogResponse}
      searchParams={resolvedSearchParams}
    />
  );
}
