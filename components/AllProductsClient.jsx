'use client'
import { Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
import { prepareSearchQuery } from "@/lib/productSearch";
import {
  readPersistedAllProductsReturnToPath,
  writePersistedAllProductsReturnToPath
} from "@/lib/navigationUtils";

const PRICE_BANDS = [
  { value: "all", label: "All prices" },
  { value: "under-2000", label: "Under Rs. 2,000" },
  { value: "2000-5000", label: "Rs. 2,000 - 5,000" },
  { value: "5000-10000", label: "Rs. 5,000 - 10,000" },
  { value: "above-10000", label: "Above Rs. 10,000" }
];

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "rating-high", label: "Top Rated" },
  { value: "discount-high", label: "Biggest Discount" },
  { value: "stock-high", label: "Most Stock" }
];

const STOCK_OPTIONS = [
  { value: "all", label: "All stock" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" }
];

const RATING_OPTIONS = [
  { value: "all", label: "All ratings" },
  { value: "4", label: "4 stars and up" },
  { value: "3", label: "3 stars and up" },
  { value: "2", label: "2 stars and up" }
];

const PRODUCTS_PER_PAGE = 20;
const CATALOG_CACHE_PREFIX = "sagecart:all-products-cache:v3";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const ALL_PRODUCTS_URL_KEYS = {
  search: "search",
  page: "page",
  category: "category",
  stock: "stock",
  rating: "rating",
  price: "price",
  sort: "sort"
};

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

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const readParamValue = (params, key, fallback = "") => {
  if (!params) return fallback;

  if (typeof params.get === "function") {
    const value = params.get(key);
    return value == null || value === "" ? fallback : String(value);
  }

  const rawValue = params[key];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  return value == null || value === "" ? fallback : String(value);
};

const parsePageParam = (value) => {
  const parsed = Number.parseInt(String(value ?? "1").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const readAllProductsStateFromParams = (searchParams) => ({
  searchQuery: readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.search, ""),
  activeCategory: readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.category, "all"),
  stockFilter: readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.stock, "all"),
  ratingFilter: readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.rating, "all"),
  priceBand: readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.price, "all"),
  sortBy: readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.sort, "featured"),
  currentPage: parsePageParam(readParamValue(searchParams, ALL_PRODUCTS_URL_KEYS.page, "1"))
});

const normalizeCatalogResponse = (data = {}) => ({
  products: Array.isArray(data.products) ? data.products : [],
  pagination: {
    page: Number.isFinite(Number(data.pagination?.page)) ? Number(data.pagination.page) : 1,
    limit: Number.isFinite(Number(data.pagination?.limit)) ? Number(data.pagination.limit) : PRODUCTS_PER_PAGE,
    total: Number.isFinite(Number(data.pagination?.total)) ? Number(data.pagination.total) : 0,
    totalPages: Math.max(1, Number.isFinite(Number(data.pagination?.totalPages)) ? Number(data.pagination.totalPages) : 1),
    hasPrevious: Boolean(data.pagination?.hasPrevious),
    hasNext: Boolean(data.pagination?.hasNext),
    start: Number.isFinite(Number(data.pagination?.start)) ? Number(data.pagination.start) : 0,
    end: Number.isFinite(Number(data.pagination?.end)) ? Number(data.pagination.end) : 0
  },
  catalogStats: {
    totalProducts: Number.isFinite(Number(data.catalogStats?.totalProducts)) ? Number(data.catalogStats.totalProducts) : 0,
    categories: Array.isArray(data.catalogStats?.categories) ? data.catalogStats.categories : []
  }
});

const isDefaultAllProductsState = (state = {}) =>
  String(state.searchQuery ?? "") === "" &&
  String(state.activeCategory ?? "all") === "all" &&
  String(state.stockFilter ?? "all") === "all" &&
  String(state.ratingFilter ?? "all") === "all" &&
  String(state.priceBand ?? "all") === "all" &&
  String(state.sortBy ?? "featured") === "featured" &&
  Number(state.currentPage ?? 1) === 1;

const readCatalogCache = (cacheKey) => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const timestamp = Number(parsed.timestamp);
    if (Number.isFinite(timestamp) && Date.now() - timestamp > CATALOG_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return normalizeCatalogResponse(parsed.response);
  } catch {
    return null;
  }
};

const writeCatalogCache = (cacheKey, response) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        response
      })
    );
  } catch {
    // Ignore cache write failures.
  }
};

const buildCatalogRequestParams = ({
  searchQuery,
  currentPage,
  activeCategory,
  stockFilter,
  ratingFilter,
  priceBand,
  sortBy,
  includeLimit = true
}) => {
  const params = new URLSearchParams();
  const normalizedSearchQuery = prepareSearchQuery(searchQuery).normalizedQuery;

  if (normalizedSearchQuery) params.set(ALL_PRODUCTS_URL_KEYS.search, normalizedSearchQuery);
  if (currentPage > 1) params.set(ALL_PRODUCTS_URL_KEYS.page, String(currentPage));
  if (activeCategory !== "all") params.set(ALL_PRODUCTS_URL_KEYS.category, activeCategory);
  if (stockFilter !== "all") params.set(ALL_PRODUCTS_URL_KEYS.stock, stockFilter);
  if (ratingFilter !== "all") params.set(ALL_PRODUCTS_URL_KEYS.rating, ratingFilter);
  if (priceBand !== "all") params.set(ALL_PRODUCTS_URL_KEYS.price, priceBand);
  if (sortBy !== "featured") params.set(ALL_PRODUCTS_URL_KEYS.sort, sortBy);
  if (includeLimit) params.set("limit", String(PRODUCTS_PER_PAGE));

  return params;
};

const buildAllProductsReturnToPath = ({
  searchQuery,
  currentPage,
  activeCategory,
  stockFilter,
  ratingFilter,
  priceBand,
  sortBy
}) => {
  const params = buildCatalogRequestParams({
    searchQuery,
    currentPage,
    activeCategory,
    stockFilter,
    ratingFilter,
    priceBand,
    sortBy,
    includeLimit: false
  });
  const queryString = params.toString();
  return `/all-products${queryString ? `?${queryString}` : ""}`;
};

const FilterSectionTitle = ({ title, subtitle }) => (
  <div className="mb-3">
    <p className="text-sm font-semibold text-[var(--ink-900)]">{title}</p>
    {subtitle && <p className="mt-1 text-xs text-[var(--ink-500)]">{subtitle}</p>}
  </div>
);

const FilterDrawer = ({
  open,
  onClose,
  categories,
  activeCategory,
  setActiveCategory,
  sortBy,
  setSortBy,
  stockFilter,
  setStockFilter,
  ratingFilter,
  setRatingFilter,
  priceBand,
  setPriceBand,
  resetFilters,
  activeFilterCount
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-[rgba(24,34,24,0.42)] backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 z-10 flex h-full w-full max-w-[34rem] flex-col border-l border-[var(--line-soft)] bg-[var(--bg-panel)] shadow-[0_30px_80px_rgba(28,38,29,0.24)]">
        <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">Filters</p>
            <h2 className="text-xl font-semibold text-[var(--ink-900)]">Refine products</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-xs font-medium text-[var(--ink-700)]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <FilterSectionTitle
              title="Categories"
              subtitle="Choose one category at a time, just like a marketplace filter."
            />
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {categories.map((category) => {
                const isActive = activeCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : "border-[var(--line-soft)] bg-white text-[var(--ink-700)] hover:bg-[var(--accent-tint)]/40"
                    }`}
                  >
                    <span>{category === "all" ? "All categories" : category}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle
              title="Sort by"
              subtitle="Pick the order you want to browse in."
            />
            <div className="grid gap-2">
              {SORT_OPTIONS.map((option) => {
                const isActive = sortBy === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSortBy(option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : "border-[var(--line-soft)] bg-white text-[var(--ink-700)] hover:bg-[var(--accent-tint)]/40"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle
              title="Price"
              subtitle="Filter the catalog by budget range."
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRICE_BANDS.map((band) => {
                const isActive = priceBand === band.value;
                return (
                  <button
                    key={band.value}
                    type="button"
                    onClick={() => setPriceBand(band.value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : "border-[var(--line-soft)] bg-white text-[var(--ink-700)] hover:bg-[var(--accent-tint)]/40"
                    }`}
                  >
                    {band.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle
              title="Stock"
              subtitle="Show only items that are ready to ship."
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STOCK_OPTIONS.map((option) => {
                const isActive = stockFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStockFilter(option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : "border-[var(--line-soft)] bg-white text-[var(--ink-700)] hover:bg-[var(--accent-tint)]/40"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle
              title="Rating"
              subtitle="Narrow to better-reviewed items."
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RATING_OPTIONS.map((option) => {
                const isActive = ratingFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRatingFilter(option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                        : "border-[var(--line-soft)] bg-white text-[var(--ink-700)] hover:bg-[var(--accent-tint)]/40"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="border-t border-[var(--line-soft)] bg-white px-5 py-4">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="flex-1 rounded-full border border-[var(--line-soft)] bg-white px-4 py-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--accent-tint)]"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={onClose}
              className="brand-button flex-1 px-4 py-3 text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

const AllProductsContent = ({
  searchParams: searchParamsProp = {},
  initialCatalogResponse = EMPTY_CATALOG_RESPONSE,
  initialCatalogReady = false
}) => {
  const initialUrlState = readAllProductsStateFromParams(searchParamsProp);

  const [searchQuery, setSearchQuery] = useState(() => initialUrlState.searchQuery);
  const [activeCategory, setActiveCategory] = useState(() => initialUrlState.activeCategory);
  const [stockFilter, setStockFilter] = useState(() => initialUrlState.stockFilter);
  const [ratingFilter, setRatingFilter] = useState(() => initialUrlState.ratingFilter);
  const [priceBand, setPriceBand] = useState(() => initialUrlState.priceBand);
  const [sortBy, setSortBy] = useState(() => initialUrlState.sortBy);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => initialUrlState.currentPage);
  const [catalogResponse, setCatalogResponse] = useState(() => initialCatalogResponse);
  const [catalogLoading, setCatalogLoading] = useState(() => !initialCatalogReady);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const hydratedRequestKeyRef = useRef("");
  const inFlightRequestKeyRef = useRef("");
  const hasVisibleCatalogProductsRef = useRef(Boolean(initialCatalogResponse?.products?.length > 0));
  const lastVisibleCatalogResponseRef = useRef(
    initialCatalogResponse?.products?.length > 0 ? initialCatalogResponse : null
  );
  const initialRequestKeyRef = useRef("");
  const skipInitialFetchRef = useRef(Boolean(initialCatalogReady));
  const hasRestoredPersistedStateRef = useRef(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const preparedSearchQuery = useMemo(() => prepareSearchQuery(deferredSearchQuery), [deferredSearchQuery]);
  const normalizedSearchQuery = preparedSearchQuery.normalizedQuery;
  const displayCatalogResponse = useMemo(() => {
    if (catalogResponse.products.length > 0) {
      return catalogResponse;
    }

    if ((catalogLoading || catalogRefreshing) && lastVisibleCatalogResponseRef.current?.products?.length > 0) {
      return lastVisibleCatalogResponseRef.current;
    }

    return catalogResponse;
  }, [catalogLoading, catalogRefreshing, catalogResponse]);

  useEffect(() => {
    if (catalogResponse.products.length > 0) {
      lastVisibleCatalogResponseRef.current = catalogResponse;
    }

    hasVisibleCatalogProductsRef.current = displayCatalogResponse.products.length > 0;
  }, [catalogResponse, displayCatalogResponse.products.length]);

  const requestParams = useMemo(
    () =>
      buildCatalogRequestParams({
        searchQuery: normalizedSearchQuery,
        currentPage,
        activeCategory,
        stockFilter,
        ratingFilter,
        priceBand,
        sortBy
      }),
    [activeCategory, currentPage, normalizedSearchQuery, priceBand, ratingFilter, sortBy, stockFilter]
  );
  const requestKey = requestParams.toString();

  if (!initialRequestKeyRef.current) {
    initialRequestKeyRef.current = requestKey;
  }

  useEffect(() => {
    if (!showFilters) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowFilters(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilters]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    const cacheKey = `${CATALOG_CACHE_PREFIX}:${requestKey}`;
    const cachedResponse = readCatalogCache(cacheKey);
    if (!cachedResponse) return undefined;

    hydratedRequestKeyRef.current = requestKey;
    setCatalogResponse(cachedResponse);
    setCatalogLoading(false);
    setCatalogRefreshing(false);
    return undefined;
  }, [requestKey]);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (hasRestoredPersistedStateRef.current) return undefined;

    if (!isDefaultAllProductsState(initialUrlState)) {
      return undefined;
    }

    const persistedPath = readPersistedAllProductsReturnToPath();
    if (!persistedPath || persistedPath === "/all-products") {
      return undefined;
    }

    try {
      const persistedUrl = new URL(persistedPath, window.location.origin);
      const restoredState = readAllProductsStateFromParams(persistedUrl.searchParams);

      if (isDefaultAllProductsState(restoredState)) {
        return undefined;
      }

      hasRestoredPersistedStateRef.current = true;
      setSearchQuery(restoredState.searchQuery);
      setActiveCategory(restoredState.activeCategory);
      setStockFilter(restoredState.stockFilter);
      setRatingFilter(restoredState.ratingFilter);
      setPriceBand(restoredState.priceBand);
      setSortBy(restoredState.sortBy);
      setCurrentPage(restoredState.currentPage);
    } catch {
      // Ignore malformed persisted paths.
    }

    return undefined;
  }, [initialUrlState]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (
      skipInitialFetchRef.current &&
      initialCatalogReady &&
      requestKey === initialRequestKeyRef.current
    ) {
      skipInitialFetchRef.current = false;
      hydratedRequestKeyRef.current = requestKey;
      setCatalogLoading(false);
      setCatalogRefreshing(false);

      try {
        window.sessionStorage.setItem(
          `${CATALOG_CACHE_PREFIX}:${requestKey}`,
          JSON.stringify({
            timestamp: Date.now(),
            response: initialCatalogResponse
          })
        );
      } catch {
        // Ignore cache write failures.
      }

      return undefined;
    }

    const cacheKey = `${CATALOG_CACHE_PREFIX}:${requestKey}`;
    const cachedResponse = readCatalogCache(cacheKey);

    if (cachedResponse) {
      if (hydratedRequestKeyRef.current !== requestKey) {
        hydratedRequestKeyRef.current = requestKey;
        setCatalogResponse(cachedResponse);
      }

      setCatalogLoading(false);
      setCatalogRefreshing(false);
      return undefined;
    }

    if (inFlightRequestKeyRef.current === requestKey) {
      return undefined;
    }

    inFlightRequestKeyRef.current = requestKey;

    const controller = new AbortController();
    const shouldShowRefreshingState = hasVisibleCatalogProductsRef.current;
    if (shouldShowRefreshingState) {
      setCatalogLoading(false);
      setCatalogRefreshing(true);
    } else {
      setCatalogLoading(true);
      setCatalogRefreshing(false);
    }

    let active = true;

    axios
      .get(`/api/product/list?${requestKey}&ts=${Date.now()}`, {
        signal: controller.signal
      })
      .then(({ data }) => {
        if (!active) return;

        if (data.success) {
          const normalizedResponse = normalizeCatalogResponse(data);
          setCatalogResponse(normalizedResponse);
          writeCatalogCache(cacheKey, normalizedResponse);
          hydratedRequestKeyRef.current = requestKey;

          if (normalizedResponse.pagination.page !== currentPage) {
            setCurrentPage(normalizedResponse.pagination.page);
          }
        } else {
          setCatalogRefreshing(false);
          setCatalogLoading(false);
        }
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
          return;
        }

        if (!active) return;
        setCatalogRefreshing(false);
        setCatalogLoading(false);
      })
      .finally(() => {
        if (!active) return;

        if (inFlightRequestKeyRef.current === requestKey) {
          inFlightRequestKeyRef.current = "";
        }

        setCatalogLoading(false);
        setCatalogRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();

      if (inFlightRequestKeyRef.current === requestKey) {
        inFlightRequestKeyRef.current = "";
      }
    };
  }, [currentPage, initialCatalogReady, initialCatalogResponse, requestKey]);

  useEffect(() => {
    if (catalogResponse.pagination.totalPages > 0 && currentPage > catalogResponse.pagination.totalPages) {
      setCurrentPage(catalogResponse.pagination.totalPages);
    }
  }, [catalogResponse.pagination.totalPages, currentPage]);

  const pagination = displayCatalogResponse.pagination;
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const safeCurrentPage = Math.min(pagination.page || currentPage, totalPages);
  const visibleStart = pagination.start || 0;
  const visibleEnd = pagination.end || 0;
  const categories = useMemo(() => {
    const uniqueCategories = Array.isArray(displayCatalogResponse.catalogStats.categories)
      ? [...displayCatalogResponse.catalogStats.categories].sort((a, b) => a.localeCompare(b))
      : [];
    return ["all", ...uniqueCategories];
  }, [displayCatalogResponse.catalogStats.categories]);

  const activeFilterCount = [
    searchQuery.trim(),
    activeCategory !== "all",
    stockFilter !== "all",
    ratingFilter !== "all",
    priceBand !== "all",
    sortBy !== "featured"
  ].filter(Boolean).length;

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleActiveCategoryChange = (value) => {
    setActiveCategory(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleStockFilterChange = (value) => {
    setStockFilter(value);
    setCurrentPage(1);
  };

  const handleRatingFilterChange = (value) => {
    setRatingFilter(value);
    setCurrentPage(1);
  };

  const handlePriceBandChange = (value) => {
    setPriceBand(value);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setActiveCategory("all");
    setStockFilter("all");
    setRatingFilter("all");
    setPriceBand("all");
    setSortBy("featured");
    setCurrentPage(1);
  };

  const currentReturnToPath = useMemo(
    () =>
      buildAllProductsReturnToPath({
        searchQuery,
        currentPage: displayCatalogResponse.pagination.page || currentPage,
        activeCategory,
        stockFilter,
        ratingFilter,
        priceBand,
        sortBy
      }),
    [activeCategory, currentPage, displayCatalogResponse.pagination.page, priceBand, ratingFilter, searchQuery, sortBy, stockFilter]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.history.replaceState(window.history.state, "", currentReturnToPath);
    writePersistedAllProductsReturnToPath(currentReturnToPath);
  }, [currentReturnToPath]);

  const shouldShowInitialGridLoading = catalogLoading && displayCatalogResponse.products.length === 0;

  return (
    <>
      <Navbar />
      <main className="px-6 py-8 md:px-16 lg:px-32">
        <section className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-5 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--ink-500)]">All products</p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--ink-900)] md:text-4xl">
                Browse the full SageCart catalog
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--ink-500)]">
                Search first, then open filters when you want to narrow by category, price, stock, or rating.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-[var(--ink-600)]">
                <p className="font-semibold text-[var(--ink-900)]">{pagination.total} products</p>
                <p className="text-xs">Page {safeCurrentPage} of {totalPages}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white px-5 py-3 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)]"
              >
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent-strong)] px-2 text-xs font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search by name, brand, or category..."
              className="w-full flex-1 rounded-full border border-[var(--line-soft)] bg-white px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-500)]">
            <span className="rounded-full border border-[var(--line-soft)] bg-white px-3 py-1">
              {activeFilterCount} active filters
            </span>
            {catalogRefreshing && displayCatalogResponse.products.length > 0 && (
              <span className="rounded-full border border-[var(--line-soft)] bg-white px-3 py-1">
                Updating catalog in the background...
              </span>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-[var(--line-soft)] bg-white px-3 py-1 font-medium text-[var(--ink-700)] hover:bg-[var(--accent-tint)]"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-[var(--ink-600)] md:flex-row md:items-center md:justify-between">
            <p>
              Showing <span className="font-semibold text-[var(--ink-900)]">{visibleStart}-{visibleEnd}</span> of{" "}
              <span className="font-semibold text-[var(--ink-900)]">{pagination.total}</span> products
            </p>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">
              Page {safeCurrentPage} of {totalPages}
            </p>
          </div>
        </section>

        {shouldShowInitialGridLoading ? (
          <div className="py-10">
            <div className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-5 shadow-sm md:p-8">
              <Loading variant="catalog" label="Loading catalog..." />
            </div>
          </div>
        ) : displayCatalogResponse.products.length > 0 ? (
          <div className="py-10">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {displayCatalogResponse.products.map((product) => (
                <ProductCard key={product._id} product={product} returnTo={currentReturnToPath} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex flex-col gap-3 rounded-[2rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] px-4 py-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-[var(--ink-500)]">
                  Page {safeCurrentPage} of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage === 1}
                    className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-10 rounded-[2rem] border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)]/40 p-10 text-center text-[var(--ink-500)]">
            <p className="text-lg font-semibold text-[var(--ink-900)]">
              {normalizedSearchQuery
                ? `No products found for "${normalizedSearchQuery}"`
                : "No products match your filters"}
            </p>
            <p className="mt-2 text-sm">
              {normalizedSearchQuery
                ? "Try a different product name, brand, or category."
                : "Try clearing one filter at a time or search with a different keyword."}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="brand-button mt-4 px-5 py-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>

      <FilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={handleActiveCategoryChange}
        sortBy={sortBy}
        setSortBy={handleSortChange}
        stockFilter={stockFilter}
        setStockFilter={handleStockFilterChange}
        ratingFilter={ratingFilter}
        setRatingFilter={handleRatingFilterChange}
        priceBand={priceBand}
        setPriceBand={handlePriceBandChange}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
      />

      <Footer />
    </>
  );
};

const AllProducts = (props) => (
  <Suspense fallback={<Loading variant="catalog" label="Loading catalog..." />}>
    <AllProductsContent {...props} />
  </Suspense>
);

export default AllProducts;
