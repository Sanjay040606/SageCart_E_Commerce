"use client"
import React, { useEffect, useRef, useState } from "react";
import { assets, BagIcon, BoxIcon, CartIcon, HomeIcon } from "@/assets/assets";
import Link from "next/link";
import { useAppContext } from "@/context/AppContext";
import Image from "next/image";
import { useClerk, UserButton } from "@clerk/nextjs";
import axios from "axios";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import { getProductPrimaryImage, normalizeProductImageUrl } from "@/lib/productDisplay";
import { usePathname } from "next/navigation";

const CATALOG_CACHE_PREFIX = "sagecart:all-products-cache:v3";
const ALL_PRODUCTS_CACHE_KEY = `${CATALOG_CACHE_PREFIX}:limit=20`;

const readAllProductsCache = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(ALL_PRODUCTS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.response ? parsed.response : null;
  } catch {
    return null;
  }
};

const storeAllProductsCache = (response) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      ALL_PRODUCTS_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        response
      })
    );
  } catch {
    // Ignore cache storage failures.
  }
};

const prefetchAllProductsCache = async () => {
  if (typeof window === "undefined") return;
  if (readAllProductsCache()) return;

  try {
    const { data } = await axios.get("/api/product/list?limit=20");
    if (data?.success) {
      storeAllProductsCache(data);
    }
  } catch {
    // Background warmup only.
  }
};

const userButtonAppearance = {
  elements: {
    userButtonPopoverRootBox: {
      maxHeight: 'calc(100dvh - 1rem)',
      maxWidth: 'calc(100vw - 1rem)',
    },
    userButtonPopoverCard: {
      maxHeight: 'calc(100dvh - 1rem)',
      maxWidth: 'min(22rem, calc(100vw - 1rem))',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      WebkitOverflowScrolling: 'touch',
    },
    userButtonPopoverMain: {
      maxHeight: 'calc(100dvh - 7rem)',
      overflowY: 'auto',
    },
  }
}

const Navbar = () => {
  const { isSeller, router, user, currency } = useAppContext();
  const pathname = usePathname();
  const { openSignIn, loaded: clerkLoaded } = useClerk();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [pendingSignIn, setPendingSignIn] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const allProductsWarmupRequestedRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const trimmedSearchQuery = searchQuery.trim();
  const hasSearchResults = suggestions.length > 0;

  useEffect(() => {
    searchRequestIdRef.current += 1;
    const requestId = searchRequestIdRef.current;

    const fetchSuggestions = async () => {
      const query = searchQuery.trim();

      if (query.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const { data } = await axios.get(`/api/product/search?q=${encodeURIComponent(query)}`);
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        if (data.success) {
          setSuggestions(data.products);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(true);
        }
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        console.error("Search error:", error);
        setSuggestions([]);
        setShowSuggestions(true);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    const timer = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchInputChange = (value) => {
    setSearchQuery(value);

    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    setSuggestions([]);
    setShowSuggestions(true);
    setIsSearching(true);
  };

  useEffect(() => {
    if (!clerkLoaded || !pendingSignIn) {
      return;
    }

    setPendingSignIn(false);
    openSignIn();
  }, [clerkLoaded, openSignIn, pendingSignIn]);

  useEffect(() => {
    if (pathname === "/all-products") {
      return undefined;
    }

    let timerId = null;
    let cancelled = false;

    const runWarmup = () => {
      if (cancelled || allProductsWarmupRequestedRef.current) return;
      allProductsWarmupRequestedRef.current = true;
      prefetchAllProductsCache();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      timerId = window.requestIdleCallback(runWarmup, { timeout: 2500 });
    } else {
      timerId = window.setTimeout(runWarmup, 1200);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && "cancelIdleCallback" in window && typeof timerId === "number") {
        window.cancelIdleCallback(timerId);
      } else if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [pathname]);

  const handleSearch = (e) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/all-products?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (productId) => {
    router.push(`/product/${productId}`);
    setSearchQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setShowMobileSearch(false);
  };

  const handleSearchToggle = () => {
    const isMobileView =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;

    if (isMobileView) {
      setShowSearch(false);
      setShowSuggestions(false);
      setShowMobileSearch((prev) => !prev);
      return;
    }

    setShowMobileSearch(false);
    setShowSearch((prev) => !prev);
  };

  const handleOpenShop = () => {
    router.prefetch("/all-products");
    prefetchAllProductsCache();
    router.push("/all-products");
  };

  return (
    <nav className="sticky top-0 z-40 mx-4 mt-4 rounded-full brand-surface px-4 py-3 text-[var(--ink-700)] sm:px-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
        <button
          type="button"
          className="flex shrink-0 cursor-pointer items-center gap-3"
          onClick={() => router.push('/')}
        >
          <Image
            src={assets.logo}
            alt="SageCart Logo"
            width={184}
            height={44}
            className="w-[128px] object-contain sm:w-[152px] md:w-[172px] lg:w-[184px]"
            priority
          />
        </button>

        <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium text-[var(--ink-700)]">
          <Link href="/" className="transition hover:text-[var(--ink-900)]">Home</Link>
          <Link
            href="/all-products"
            className="transition hover:text-[var(--ink-900)]"
            onMouseEnter={prefetchAllProductsCache}
            onFocus={prefetchAllProductsCache}
            onPointerDown={prefetchAllProductsCache}
            onTouchStart={prefetchAllProductsCache}
          >
            Shop
          </Link>
          <Link href="/about" className="transition hover:text-[var(--ink-900)]">About</Link>
          <Link href="/contact" className="transition hover:text-[var(--ink-900)]">Contact</Link>
          <Link href="/help" className="transition hover:text-[var(--ink-900)]">Help</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="relative shrink-0">
            <button
              onClick={handleSearchToggle}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-soft)] bg-white/80 transition hover:bg-[var(--accent-tint)]"
              aria-label="Search products"
              title="Search"
              aria-expanded={showSearch || showMobileSearch}
            >
              <Image className="w-4 h-4" src={assets.search_icon} alt="search icon" />
            </button>

            {showSearch && (
              <div className="absolute right-0 top-full z-50 mt-3 hidden w-[min(22rem,calc(100vw-2rem))] rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-3 shadow-xl md:block">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onKeyPress={handleSearch}
                    onBlur={() => setTimeout(() => {
                      setShowSearch(false);
                      setShowSuggestions(false);
                    }, 200)}
                    onFocus={() => searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                    placeholder="Search by name, brand, or category..."
                    autoFocus
                    className="min-w-0 flex-1 rounded-full border border-[var(--line-soft)] bg-white/80 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearch(false);
                      setShowSuggestions(false);
                    }}
                    className="shrink-0 rounded-full border border-[var(--line-soft)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink-700)]"
                  >
                    Close
                  </button>
                </div>

                {showSuggestions && isSearching && trimmedSearchQuery.length >= 2 && (
                  <div className="mt-3 rounded-2xl border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-[var(--ink-900)]">Searching...</p>
                    <p className="mt-1 text-xs text-[var(--ink-500)]">Finding the closest product matches.</p>
                  </div>
                )}

                {showSuggestions && !isSearching && suggestions.length > 0 && (
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-[var(--line-soft)] bg-white">
                    {suggestions.map((product) => {
                      const productImage = normalizeProductImageUrl(getProductPrimaryImage(product));
                      return (
                        <div
                          key={product._id}
                          onClick={() => handleSuggestionClick(product._id)}
                          className="flex cursor-pointer items-center gap-3 border-b border-[var(--line-soft)]/70 px-4 py-3 transition hover:bg-[var(--accent-tint)]/50 last:border-b-0"
                        >
                          <Image
                            src={productImage || assets.box_icon}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--ink-900)]">{product.name}</p>
                            <p className="text-xs text-[var(--ink-500)]">{product.category}</p>
                          </div>
                          <p className="text-sm font-semibold text-[var(--accent-strong)]">
                            {formatPrice(convertUSDToINR(product.offerPrice), currency)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showSuggestions && !isSearching && trimmedSearchQuery.length >= 2 && !hasSearchResults && (
                  <div className="mt-3 rounded-2xl border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-[var(--ink-900)]">No products found</p>
                    <p className="mt-1 text-xs text-[var(--ink-500)]">Try a different name, brand, or category.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {isSeller && (
            <button
              onClick={() => router.push('/seller')}
              className="hidden shrink-0 items-center rounded-full border border-[var(--line-soft)] bg-white/80 px-3 py-2 text-xs transition hover:bg-[var(--accent-tint)] sm:inline-flex sm:px-4"
            >
              <span className="sm:hidden">Seller</span>
              <span className="hidden sm:inline">Seller Dashboard</span>
            </button>
          )}

          {user ? (
            <UserButton appearance={userButtonAppearance}>
              <UserButton.MenuItems>
                <UserButton.Action label="Home" labelIcon={<HomeIcon />} onClick={() => router.push('/')} />
                <UserButton.Action label="Shop" labelIcon={<BoxIcon />} onClick={handleOpenShop} />
                <UserButton.Action label="About" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4b5563" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z" /></svg>} onClick={() => router.push('/about')} />
                <UserButton.Action label="Contact" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4b5563" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25A2.25 2.25 0 015.25 6h13.5A2.25 2.25 0 0121 8.25v7.5A2.25 2.25 0 0118.75 18H5.25A2.25 2.25 0 013 15.75v-7.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="m3.75 7.5 8.25 5.25L20.25 7.5" /></svg>} onClick={() => router.push('/contact')} />
                <UserButton.Action label="Help Center" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4b5563" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} onClick={() => router.push('/help')} />
                <UserButton.Action label="Cart" labelIcon={<CartIcon />} onClick={() => router.push('/cart')} />
                <UserButton.Action label="My Orders" labelIcon={<BagIcon />} onClick={() => router.push('/my-orders')} />
                <UserButton.Action label="Wishlist" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>} onClick={() => router.push('/wishlist')} />
                {isSeller && <UserButton.Action label="Seller Dashboard" labelIcon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#4b5563" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16M4 12h16M4 16.5h10" /></svg>} onClick={() => router.push('/seller')} />}
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <button
              onClick={() => {
                if (!clerkLoaded) {
                  setPendingSignIn(true);
                  return;
                }
                openSignIn();
              }}
              className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white/80 px-3 py-2 transition hover:bg-[var(--accent-tint)] sm:px-4"
            >
              <Image src={assets.user_icon} alt="user icon" />
              <span className="hidden sm:inline">{clerkLoaded ? "Account" : pendingSignIn ? "Loading..." : "Account"}</span>
            </button>
          )}
        </div>
      </div>
      {showMobileSearch && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close search"
            className="absolute inset-0 bg-[rgba(24,34,24,0.42)] backdrop-blur-[2px]"
            onClick={() => {
              setShowMobileSearch(false)
              setShowSuggestions(false)
            }}
          />
          <div className="absolute left-3 right-3 top-20 max-h-[calc(100dvh-6rem)] overflow-hidden rounded-[1.75rem] border border-[var(--line-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,244,236,0.96))] p-4 shadow-[0_30px_80px_rgba(28,38,29,0.25)] sm:top-24">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-900)]">Search products</p>
                <p className="text-xs text-[var(--ink-500)]">Type a product name or category</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMobileSearch(false)
                  setShowSuggestions(false)
                }}
                className="rounded-full border border-[var(--line-soft)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink-700)]"
              >
                Close
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={handleSearch}
                onFocus={() => searchQuery.trim().length >= 2 && setShowSuggestions(true)}
                placeholder="Search by name, brand, or category..."
                autoFocus
                className="w-full rounded-full border border-[var(--line-soft)] bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            {showSuggestions && isSearching && trimmedSearchQuery.length >= 2 && (
              <div className="mt-3 rounded-[1.25rem] border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-5 text-center">
                <p className="text-sm font-semibold text-[var(--ink-900)]">Searching...</p>
                <p className="mt-1 text-xs text-[var(--ink-500)]">Finding the closest product matches.</p>
              </div>
            )}

            {showSuggestions && !isSearching && suggestions.length > 0 && (
              <div className="mt-3 max-h-[calc(100dvh-15rem)] overflow-y-auto rounded-[1.25rem] border border-[var(--line-soft)] bg-white">
                {suggestions.map((product) => {
                  const productImage = normalizeProductImageUrl(getProductPrimaryImage(product));
                  return (
                    <div
                      key={product._id}
                      onClick={() => handleSuggestionClick(product._id)}
                      className="flex items-center gap-3 border-b border-[var(--line-soft)]/70 px-4 py-3 last:border-b-0"
                    >
                      <Image
                        src={productImage || assets.box_icon}
                        alt={product.name}
                        width={36}
                        height={36}
                        className="rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--ink-900)]">{product.name}</p>
                        <p className="text-xs text-[var(--ink-500)]">{product.category}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showSuggestions && !isSearching && trimmedSearchQuery.length >= 2 && !hasSearchResults && (
              <div className="mt-3 rounded-[1.25rem] border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-5 text-center">
                <p className="text-sm font-semibold text-[var(--ink-900)]">No products found</p>
                <p className="mt-1 text-xs text-[var(--ink-500)]">Try a different name, brand, or category.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
