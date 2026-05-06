'use client'
import React, { useCallback, useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import Footer from "@/components/seller/Footer";
import axios from "axios";
import toast from "react-hot-toast";
import { formatPrice } from "@/lib/currencyUtils";
import { getProductPrimaryImage, normalizeProductImageUrl } from "@/lib/productDisplay";
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
    <div className="flex-1 min-h-screen w-full min-w-0 overflow-x-hidden flex flex-col justify-between">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
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
                    const productImage = normalizeProductImageUrl(getProductPrimaryImage(product));
                    const variantLabel = getCategoryVariantConfig(product.category).label;
                    const variantSummary = getVariantSummary(product);
                    return (
                      <div key={product._id} className="w-full rounded-2xl border border-gray-500/20 bg-white p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 rounded-xl bg-gray-500/10 p-2">
                            <Image
                              src={productImage || assets.box_icon}
                              alt="product Image"
                              className="h-20 w-20 object-contain"
                              width={1280}
                              height={720}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{product.name}</p>
                            <p className="mt-1 text-xs text-gray-500">{product.category}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-600">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-400">{variantLabel}</p>
                            <p className="mt-1">{variantSummary}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-400">Price</p>
                            <p className="mt-1 font-medium text-gray-900">{formatPrice(Math.round(product.offerPrice * 94), currency)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-400">Stock</p>
                            <p className="mt-1">{product.stock ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
                            <p className="mt-1 capitalize">{product.status || (product.stock === 0 ? "out_of_stock" : "active")}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => router.push(`/product/${product._id}`)}
                          className="brand-button mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3"
                        >
                          <span>Visit</span>
                          <Image
                            className="h-3.5"
                            src={assets.redirect_icon}
                            alt="redirect_icon"
                          />
                        </button>
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
                            <td className="px-4 py-3 capitalize">{product.status || (product.stock === 0 ? "out_of_stock" : "active")}</td>
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
