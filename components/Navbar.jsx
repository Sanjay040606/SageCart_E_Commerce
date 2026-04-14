"use client"
import React, { useState, useEffect } from "react";
import { assets, BagIcon, BoxIcon, CartIcon, HomeIcon } from "@/assets/assets";
import Link from "next/link";
import { useAppContext } from "@/context/AppContext";
import Image from "next/image";
import { useClerk, UserButton } from "@clerk/nextjs";
import axios from "axios";

const Navbar = () => {
  const { isSeller, router, user, currency } = useAppContext();
  const { openSignIn } = useClerk();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length === 0) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const { data } = await axios.get(`/api/product/search?q=${encodeURIComponent(searchQuery)}`);
        if (data.success) {
          setSuggestions(data.products);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSuggestions([]);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
  };

  return (
    <nav className="sticky top-0 z-40 mx-4 mt-4 rounded-full brand-surface px-6 md:px-10 lg:px-12 py-3 text-[var(--ink-700)]">
      <div className="flex items-center justify-between gap-4">
        <div
          className="cursor-pointer flex items-center gap-3 min-w-fit"
          onClick={() => router.push('/')}
        >
          <div className="flex items-center">
            <Image src={assets.logo} alt="SageCart Logo" width={150} height={40} className="object-contain" priority />
          </div>
        </div>

        <div className="items-center gap-6 lg:gap-8 max-md:hidden flex">
          <Link href="/" className="hover:text-[var(--ink-900)] transition">
            Home
          </Link>
          <Link href="/all-products" className="hover:text-[var(--ink-900)] transition">
            Shop
          </Link>
          <Link href="/about" className="hover:text-[var(--ink-900)] transition">
            About
          </Link>
          <Link href="/contact" className="hover:text-[var(--ink-900)] transition">
            Contact
          </Link>
          <Link href="/help" className="hover:text-[var(--ink-900)] transition">
            Help
          </Link>
          {isSeller && (
            <button
              onClick={() => router.push('/seller')}
              className="px-4 py-2 rounded-full border border-[var(--line-soft)] text-xs bg-white/70 hover:bg-[var(--accent-tint)] transition"
            >
              Seller Dashboard
            </button>
          )}
        </div>

        <ul className="hidden md:flex items-center gap-4">
          <div className="relative w-56">
            {showSearch ? (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleSearch}
                  onBlur={() => setTimeout(() => {
                    setShowSearch(false);
                    setShowSuggestions(false);
                  }, 200)}
                  onFocus={() => searchQuery && setShowSuggestions(true)}
                  placeholder="Search softly curated finds..."
                  autoFocus
                  className="w-full px-4 py-2 border border-[var(--line-soft)] bg-white/80 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-panel)] border border-[var(--line-soft)] rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto">
                    {suggestions.map((product) => (
                      <div
                        key={product._id}
                        onClick={() => handleSuggestionClick(product._id)}
                        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line-soft)]/70 hover:bg-[var(--accent-tint)]/50 cursor-pointer transition"
                      >
                        {product.image && product.image[0] && (
                          <Image
                            src={product.image[0]}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-xl object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--ink-900)] truncate">{product.name}</p>
                          <p className="text-xs text-[var(--ink-500)]">{product.category}</p>
                        </div>
                        <p className="text-sm font-semibold text-[var(--accent-strong)]">{currency}{product.offerPrice}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="h-10 w-10 rounded-full border border-[var(--line-soft)] bg-white/80 flex items-center justify-center hover:bg-[var(--accent-tint)] transition"
              >
                <Image className="w-4 h-4" src={assets.search_icon} alt="search icon" />
              </button>
            )}
          </div>

          {user ? (
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Action label="Cart" labelIcon={<CartIcon />} onClick={() => router.push('/cart')} />
              </UserButton.MenuItems>
              <UserButton.MenuItems>
                <UserButton.Action label="My Orders" labelIcon={<BagIcon />} onClick={() => router.push('/my-orders')} />
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <button
              onClick={openSignIn}
              className="flex items-center gap-2 rounded-full px-4 py-2 bg-white/80 border border-[var(--line-soft)] hover:bg-[var(--accent-tint)] transition"
            >
              <Image src={assets.user_icon} alt="user icon" />
              Account
            </button>
          )}
        </ul>

        <div className="flex items-center md:hidden gap-3">
          {isSeller && (
            <button
              onClick={() => router.push('/seller')}
              className="text-xs border border-[var(--line-soft)] bg-white/80 px-4 py-2 rounded-full"
            >
              Seller
            </button>
          )}
          {user ? (
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Action label="Home" labelIcon={<HomeIcon />} onClick={() => router.push('/')} />
              </UserButton.MenuItems>
              <UserButton.MenuItems>
                <UserButton.Action label="Products" labelIcon={<BoxIcon />} onClick={() => router.push('/all-products')} />
              </UserButton.MenuItems>
              <UserButton.MenuItems>
                <UserButton.Action label="Cart" labelIcon={<CartIcon />} onClick={() => router.push('/cart')} />
              </UserButton.MenuItems>
              <UserButton.MenuItems>
                <UserButton.Action label="My Orders" labelIcon={<BagIcon />} onClick={() => router.push('/my-orders')} />
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <button
              onClick={openSignIn}
              className="flex items-center gap-2 rounded-full px-4 py-2 bg-white/80 border border-[var(--line-soft)]"
            >
              <Image src={assets.user_icon} alt="user icon" />
              Account
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
