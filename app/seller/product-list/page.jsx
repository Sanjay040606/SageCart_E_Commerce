'use client'
import React, { useCallback, useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import Footer from "@/components/seller/Footer";
import axios from "axios";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/currencyUtils";
import { getProductAvailabilitySummary, getProductPrimaryImage, normalizeProductImageUrl } from "@/lib/productDisplay";
import { getCategoryVariantConfig } from "@/lib/productVariantRules";

const getVariantSummary = (product) => {
  const variantMode = product?.variantMode || "";
  const savedValues =
    variantMode === "size"
      ? product?.sizes
      : variantMode === "color"
        ? product?.colors
        : Array.isArray(product?.variantOptions)
          ? product.variantOptions.map((variant) => variant?.label).filter(Boolean)
          : [];

  const values = Array.isArray(savedValues)
    ? savedValues
        .map((entry) => String(entry?.size ?? entry?.label ?? entry ?? "").trim())
        .filter(Boolean)
    : [];

  if (values.length > 0) {
    return values.join(", ");
  }

  if (Array.isArray(product?.variantOptions) && product.variantOptions.length > 0) {
    return product.variantOptions
      .map((variant) => String(variant?.label ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return "-";
};

const getMobileStatusBadgeClasses = (status) => {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "low_stock":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "out_of_stock":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-600";
  }
};

const getMobileStatusLabel = (status) => {
  switch (status) {
    case "active":
      return "In stock";
    case "low_stock":
      return "Low stock";
    case "out_of_stock":
      return "Out of stock";
    case "inactive":
      return "Inactive";
    default:
      return status || "Unknown";
  }
};

const ProductList = () => {
  const { router, getToken, user, currency } = useAppContext();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSellerProduct = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/product/seller-list", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        setProducts(data.products);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (user) {
      fetchSellerProduct();
    }
  }, [fetchSellerProduct, user]);

  return (
    <div className="w-full min-w-0 overflow-x-hidden flex flex-col">
      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your products...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="w-full space-y-5 p-4 md:p-10">
            <h2 className="pb-1 text-lg font-medium">All Product</h2>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-gray-300 bg-white p-8 text-center text-gray-500 shadow-sm">
                <p className="text-base font-medium">No products yet</p>
                <p>Add a product first, then it will appear here.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:hidden">
                  {products.map((product) => {
                    const availability = getProductAvailabilitySummary(product);
                    const productImage = normalizeProductImageUrl(getProductPrimaryImage(product));
                    const variantLabel = getCategoryVariantConfig(product.category).label;
                    const variantSummary = getVariantSummary(product);
                    const mobileStatusLabel = getMobileStatusLabel(availability.status);

                    return (
                      <div
                        key={product._id}
                        className="relative w-full overflow-hidden rounded-[1.5rem] border border-[rgba(111,129,103,0.18)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfaf6_100%)] shadow-[0_18px_42px_rgba(77,87,74,0.10)]"
                      >
                        <div className="h-1 bg-[linear-gradient(90deg,var(--accent)_0%,#9fb392_100%)]" />
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                              <div className="absolute -inset-2 rounded-[1.6rem] bg-[radial-gradient(circle_at_50%_35%,rgba(111,129,103,0.22)_0%,rgba(111,129,103,0.10)_35%,transparent_72%)] blur-lg" />
                              <div className="relative shrink-0 rounded-[1.35rem] border border-white/80 bg-[linear-gradient(180deg,#f3f5ef_0%,#e8eee3_100%)] p-2.5 shadow-inner">
                              <Image
                                src={productImage || assets.box_icon}
                                alt="product Image"
                                className="h-20 w-20 object-contain"
                                width={1280}
                                height={720}
                              />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-base font-semibold text-[var(--ink-900)]">{product.name}</p>
                                  <p className="mt-1 text-sm text-[var(--ink-500)]">{product.category}</p>
                                </div>

                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] shadow-sm backdrop-blur-[2px] ${getMobileStatusBadgeClasses(availability.status)}`}
                                >
                                  {mobileStatusLabel}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="brand-tag rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                                  {variantLabel}
                                </span>
                                <span className="rounded-full border border-[var(--line-soft)] bg-white px-2.5 py-1 text-[10px] font-medium text-[var(--ink-700)]">
                                  {variantSummary}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-2xl border border-white/80 bg-[linear-gradient(180deg,#f8f6f0_0%,#f1f4ec_100%)] px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-500)]">Price</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--ink-900)]">
                                {formatPrice(Math.round(product.offerPrice * 94), currency)}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/80 bg-[linear-gradient(180deg,#f8f6f0_0%,#f1f4ec_100%)] px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-500)]">Stock</p>
                              <p className="mt-1 text-sm font-semibold text-[var(--ink-900)]">{product.stock ?? 0}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-4">
                            <p className="text-xs text-[var(--ink-500)]">
                              Tap to review the full seller record.
                            </p>
                            <button
                              onClick={() => router.push(`/product/${product._id}`)}
                              className="brand-button inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-[0_10px_20px_rgba(111,129,103,0.18)]"
                            >
                              <span>Visit</span>
                              <Image
                                className="h-3 w-3"
                                src={assets.redirect_icon}
                                alt="redirect_icon"
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden overflow-hidden rounded-md border border-gray-500/20 bg-white md:block">
                  <table className="table-fixed w-full overflow-hidden">
                    <thead className="text-left text-sm text-gray-900">
                      <tr>
                        <th className="w-2/3 md:w-2/5 px-4 py-3 font-medium truncate">Product</th>
                        <th className="px-4 py-3 font-medium truncate max-sm:hidden">Category</th>
                        <th className="px-4 py-3 font-medium truncate max-sm:hidden">Colors</th>
                        <th className="px-4 py-3 font-medium truncate">Price</th>
                        <th className="px-4 py-3 font-medium truncate">Stock</th>
                        <th className="px-4 py-3 font-medium truncate">Status</th>
                        <th className="px-4 py-3 font-medium truncate max-sm:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-500">
                      {products.map((product) => {
                        const availability = getProductAvailabilitySummary(product);
                        const productImage = normalizeProductImageUrl(getProductPrimaryImage(product));
                        const variantLabel = getCategoryVariantConfig(product.category).label;
                        const variantSummary = getVariantSummary(product);
                        return (
                          <tr key={product._id} className="border-t border-gray-500/20">
                            <td className="md:px-4 pl-2 md:pl-4 py-3 flex items-center space-x-3 truncate">
                              <div className="bg-gray-500/10 rounded p-2">
                                <Image
                                  src={productImage || assets.box_icon}
                                  alt="product Image"
                                  className="w-16"
                                  width={1280}
                                  height={720}
                                />
                              </div>
                              <span className="truncate w-full">
                                {product.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-sm:hidden">{product.category}</td>
                            <td className="px-4 py-3 max-sm:hidden">
                              <span className="block text-[10px] uppercase tracking-wide text-gray-400">{variantLabel}</span>
                              <span className="block mt-1">{variantSummary}</span>
                            </td>
                            <td className="px-4 py-3">{formatPrice(Math.round(product.offerPrice * 94), currency)}</td>
                            <td className="px-4 py-3">{product.stock ?? 0}</td>
                            <td className="px-4 py-3 capitalize">{availability.status}</td>
                            <td className="px-4 py-3 max-sm:hidden">
                              <button onClick={() => router.push(`/product/${product._id}`)} className="brand-button flex items-center gap-1 rounded-md px-1.5 py-2 md:px-3.5">
                                <span className="hidden md:block">Visit</span>
                                <Image
                                  className="h-3.5"
                                  src={assets.redirect_icon}
                                  alt="redirect_icon"
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <Footer />
        </>
      )}
    </div>
  );
};

export default ProductList;
