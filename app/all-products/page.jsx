'use client'
import { Suspense, useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
import { useAppContext } from "@/context/AppContext";
import { useSearchParams } from "next/navigation";
import { convertUSDToINR } from "@/lib/currencyUtils";
import { getProductAverageRating } from "@/lib/productDisplay";
import { dedupeCatalogProducts } from "@/lib/productCatalog";
import { buildProductSearchTokens, getPrimarySearchFamily, getProductSearchScore, matchesSearchTokens, normalizeSearchText, prepareSearchQuery } from "@/lib/productSearch";

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
const ALL_PRODUCTS_URL_KEYS = {
  search: "search",
  page: "page",
  category: "category",
  stock: "stock",
  rating: "rating",
  price: "price",
  sort: "sort"
};

const parsePageParam = (value) => {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const readAllProductsStateFromParams = (searchParams) => ({
  searchQuery: searchParams.get(ALL_PRODUCTS_URL_KEYS.search) || "",
  activeCategory: searchParams.get(ALL_PRODUCTS_URL_KEYS.category) || "all",
  stockFilter: searchParams.get(ALL_PRODUCTS_URL_KEYS.stock) || "all",
  ratingFilter: searchParams.get(ALL_PRODUCTS_URL_KEYS.rating) || "all",
  priceBand: searchParams.get(ALL_PRODUCTS_URL_KEYS.price) || "all",
  sortBy: searchParams.get(ALL_PRODUCTS_URL_KEYS.sort) || "featured",
  currentPage: parsePageParam(searchParams.get(ALL_PRODUCTS_URL_KEYS.page))
});

const syncAllProductsUrl = ({
  searchQuery,
  currentPage,
  activeCategory,
  stockFilter,
  ratingFilter,
  priceBand,
  sortBy
}) => {
  if (typeof window === "undefined") return;

  const nextParams = new URLSearchParams();

  if (searchQuery.trim()) nextParams.set(ALL_PRODUCTS_URL_KEYS.search, searchQuery.trim());
  if (currentPage > 1) nextParams.set(ALL_PRODUCTS_URL_KEYS.page, String(currentPage));
  if (activeCategory !== "all") nextParams.set(ALL_PRODUCTS_URL_KEYS.category, activeCategory);
  if (stockFilter !== "all") nextParams.set(ALL_PRODUCTS_URL_KEYS.stock, stockFilter);
  if (ratingFilter !== "all") nextParams.set(ALL_PRODUCTS_URL_KEYS.rating, ratingFilter);
  if (priceBand !== "all") nextParams.set(ALL_PRODUCTS_URL_KEYS.price, priceBand);
  if (sortBy !== "featured") nextParams.set(ALL_PRODUCTS_URL_KEYS.sort, sortBy);

  const nextUrl = `${window.location.pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
  window.history.replaceState(window.history.state, "", nextUrl);
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
  categoryCounts,
  totalProducts,
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
                const count = category === "all" ? totalProducts : categoryCounts[category] || 0;

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
                    <span className="text-xs opacity-70">{count}</span>
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

const AllProductsContent = () => {
  const { products, productsLoading } = useAppContext();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const initialUrlState = readAllProductsStateFromParams(searchParams);

  const [searchQuery, setSearchQuery] = useState(() => initialUrlState.searchQuery);
  const [activeCategory, setActiveCategory] = useState(() => initialUrlState.activeCategory);
  const [stockFilter, setStockFilter] = useState(() => initialUrlState.stockFilter);
  const [ratingFilter, setRatingFilter] = useState(() => initialUrlState.ratingFilter);
  const [priceBand, setPriceBand] = useState(() => initialUrlState.priceBand);
  const [sortBy, setSortBy] = useState(() => initialUrlState.sortBy);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => initialUrlState.currentPage);
  const liveSearchQuery = useMemo(() => prepareSearchQuery(searchQuery), [searchQuery]);
  const preparedSearchQuery = liveSearchQuery;
  const isSearchSettling = false;

  useEffect(() => {
    const nextUrlState = readAllProductsStateFromParams(new URLSearchParams(searchParamsString));

    setSearchQuery(nextUrlState.searchQuery);
    setActiveCategory(nextUrlState.activeCategory);
    setStockFilter(nextUrlState.stockFilter);
    setRatingFilter(nextUrlState.ratingFilter);
    setPriceBand(nextUrlState.priceBand);
    setSortBy(nextUrlState.sortBy);
    setCurrentPage(nextUrlState.currentPage);
  }, [searchParamsString]);

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

  const catalogProducts = useMemo(() => dedupeCatalogProducts(products), [products]);

  const catalogIndex = useMemo(() => {
    return catalogProducts.map((product) => {
      const priceInr = convertUSDToINR(product.offerPrice);
      const averageRating = getProductAverageRating(product);
      const ratingValue = averageRating || 0;
      const searchTokens = buildProductSearchTokens(product);
      const nameText = normalizeSearchText(product?.name ?? product?.title);
      const categoryText = normalizeSearchText(product?.category);
      const brandText = normalizeSearchText(product?.brand ?? product?.datasetMeta?.brand);
      const slugText = normalizeSearchText(product?.slug ?? product?.datasetMeta?.slug);

      return {
        product,
        searchTokens,
        searchFamily: getPrimarySearchFamily(searchTokens),
        nameText,
        categoryText,
        brandText,
        slugText,
        priceInr,
        rating: ratingValue,
        status: product.status,
        stock: Number(product.stock || 0),
        discountPercent: Number(product.discountPercent || 0),
        dateValue: Number(product.date || 0)
      };
    });
  }, [catalogProducts]);

  const categoryCounts = useMemo(() => {
    return catalogProducts.reduce((counts, product) => {
      const category = product?.category;
      if (!category) return counts;
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
  }, [catalogProducts]);

  const categories = useMemo(() => {
    const uniqueCategories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
    return ["all", ...uniqueCategories];
  }, [categoryCounts]);

  const filteredProducts = useMemo(() => {
    const matchesPriceBand = (priceInr) => {
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

    const matchesRating = (rating) => {
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

    const matchesStock = (status) => {
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

    const query = preparedSearchQuery.normalizedQuery;

    const items = catalogIndex.filter(({ product, searchTokens, searchFamily, nameText, categoryText, brandText, slugText, priceInr, rating, status }) => {
      const matchesSearch = matchesSearchTokens(searchTokens, query, preparedSearchQuery);
      const matchesCategory = activeCategory === "all" || product.category === activeCategory;
      const matchesSearchFamily = !preparedSearchQuery.queryFamily
        || searchFamily === preparedSearchQuery.queryFamily
        || nameText === query
        || categoryText === query
        || brandText === query
        || slugText === query;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSearchFamily &&
        matchesPriceBand(priceInr) &&
        matchesRating(rating) &&
        matchesStock(status)
      );
    }).map((item) => ({
      ...item,
      searchScore: query ? getProductSearchScore(item.product, query, item, preparedSearchQuery) : 0
    }));

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

    const sorted = [...items];
    if (query) {
      sorted.sort((a, b) => {
        const relevanceDiff = b.searchScore - a.searchScore;
        if (relevanceDiff !== 0) return relevanceDiff;
        return compareBySort(a, b);
      });
      return sorted;
    }

    sorted.sort(compareBySort);

    return sorted;
  }, [activeCategory, catalogIndex, preparedSearchQuery, priceBand, ratingFilter, sortBy, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (productsLoading) return;

    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, productsLoading, totalPages]);

  useEffect(() => {
    if (productsLoading) return;

    syncAllProductsUrl({
      searchQuery: liveSearchQuery.normalizedQuery,
      currentPage: safeCurrentPage,
      activeCategory,
      stockFilter,
      ratingFilter,
      priceBand,
      sortBy
    });
  }, [activeCategory, currentPage, liveSearchQuery.normalizedQuery, priceBand, productsLoading, ratingFilter, safeCurrentPage, sortBy, stockFilter]);

  const visibleProducts = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, safeCurrentPage]);

  const visibleStart = filteredProducts.length === 0 ? 0 : ((safeCurrentPage - 1) * PRODUCTS_PER_PAGE) + 1;
  const visibleEnd = filteredProducts.length === 0 ? 0 : Math.min(safeCurrentPage * PRODUCTS_PER_PAGE, filteredProducts.length);

  const activeFilterCount = [
    liveSearchQuery.normalizedQuery,
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

  if (productsLoading) {
    return (
      <>
        <Navbar />
        <main className="px-6 py-8 md:px-16 lg:px-32">
          <section className="rounded-[2rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-5 shadow-sm md:p-8">
            <Loading />
          </section>
        </main>
        <Footer />
      </>
    );
  }

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
                <p className="font-semibold text-[var(--ink-900)]">{filteredProducts.length} products</p>
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
              <span className="font-semibold text-[var(--ink-900)]">{filteredProducts.length}</span> products
            </p>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">
              Page {safeCurrentPage} of {totalPages}
            </p>
          </div>
        </section>

        {isSearchSettling ? (
          <div className="mt-10 rounded-[2rem] border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)]/40 p-10 text-center text-[var(--ink-500)]">
            <p className="text-lg font-semibold text-[var(--ink-900)]">Searching...</p>
            <p className="mt-2 text-sm">
              Updating the results for &quot;{liveSearchQuery.normalizedQuery}&quot;.
            </p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="py-10">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleProducts.map(({ product }) => (
                <ProductCard key={product._id} product={product} />
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
              {liveSearchQuery.normalizedQuery
                ? `No products found for "${liveSearchQuery.normalizedQuery}"`
                : "No products match your filters"}
            </p>
            <p className="mt-2 text-sm">
              {liveSearchQuery.normalizedQuery
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
        categoryCounts={categoryCounts}
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
        totalProducts={catalogProducts.length}
      />

      <Footer />
    </>
  );
};

const AllProducts = () => (
  <Suspense fallback={<Loading />}>
    <AllProductsContent />
  </Suspense>
);

export default AllProducts;
