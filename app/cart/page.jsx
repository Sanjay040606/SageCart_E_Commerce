'use client'
import React from "react";
import toast from "react-hot-toast";
import { assets } from "@/assets/assets";
import OrderSummary from "@/components/OrderSummary";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Loading from "@/components/Loading";
import Footer from "@/components/Footer";
import { useAppContext } from "@/context/AppContext";
import { formatPrice } from "@/lib/currencyUtils";
import {
  getCartItemOriginalUnitPriceInr,
  getCartItemUnitPriceInr,
  getCartProductQuantity,
  parseCartKey
} from "@/lib/cartUtils";
import { getProductPrimaryImage, getProductVariantImage, normalizeProductImageUrl } from "@/lib/productDisplay";

const Cart = () => {
  const { products, productsLoading, router, cartItems, updateCartQuantity, getCartCount, currency } = useAppContext();

  if (productsLoading) {
    return <Loading />;
  }

  const cartEntries = Object.entries(cartItems)
    .map(([cartKey, quantity]) => {
      const parsedKey = parseCartKey(cartKey);
      const product = products.find((item) => item._id === parsedKey.productId);
      const qty = Number(quantity) || 0;

      if (!product || qty <= 0) return null;

      const otherQuantity = getCartProductQuantity(cartItems, parsedKey.productId, cartKey);
      const remainingStock = Math.max(0, product.stock - otherQuantity);
      const unitPriceInr = getCartItemUnitPriceInr(product, parsedKey);
      const originalUnitPriceInr = getCartItemOriginalUnitPriceInr(product, parsedKey);
      const variantImage = getProductVariantImage(product, parsedKey);

      return {
        cartKey,
        product,
        quantity: qty,
        variantLabel: parsedKey.variantLabel,
        variantType: parsedKey.variantType,
        variantId: parsedKey.variantId,
        productImage: normalizeProductImageUrl(variantImage || getProductPrimaryImage(product)),
        unitPriceInr,
        originalUnitPriceInr,
        remainingStock,
        lineTotalInr: unitPriceInr * qty
      };
    })
    .filter(Boolean);

  return (
    <>
      <Navbar />
      <div className="min-h-[100dvh] bg-[var(--bg-soft)] px-0 py-0 md:px-16 md:py-10 lg:px-32">
        <div className="min-h-[100dvh] bg-white px-4 pb-8 pt-5 shadow-none md:min-h-0 md:rounded-[2rem] md:bg-[var(--bg-panel)] md:p-8 lg:p-10">
          <div className="mb-6 border-b border-[var(--line-soft)] pb-5 md:mb-8 md:pb-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.22em] text-[var(--ink-500)]">SageCart bag</p>
                <h1 className="text-3xl font-semibold text-[var(--ink-900)] md:text-4xl">
                  Your Cart
                </h1>
              </div>
              <p className="text-base text-[var(--ink-500)] md:text-lg">{getCartCount()} items selected</p>
            </div>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1">
              <div className="md:hidden space-y-4">
                {cartEntries.map(({ cartKey, variantLabel, quantity, product, productImage, unitPriceInr, originalUnitPriceInr, remainingStock, lineTotalInr }) => (
                  <div key={cartKey} className="rounded-2xl border border-[var(--line-soft)] bg-[var(--bg-panel)] p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <button className="shrink-0" onClick={() => router.push(`/product/${product._id}`)}>
                        <div className="rounded-[1.25rem] bg-[var(--bg-soft)] p-3">
                          <Image
                            src={productImage || assets.box_icon}
                            alt={product.name}
                            className="h-20 w-20 object-cover mix-blend-multiply"
                            width={1280}
                            height={720}
                          />
                        </div>
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className="cursor-pointer text-sm font-semibold text-[var(--ink-900)]"
                          onClick={() => router.push(`/product/${product._id}`)}
                        >
                          {product.name} {variantLabel ? `(${variantLabel})` : ""}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-500)]">
                          Offer: {formatPrice(unitPriceInr, currency)}
                        </p>
                        <button
                          className="mt-2 text-xs text-[var(--accent-strong)]"
                          onClick={() => updateCartQuantity(cartKey, 0)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Price</p>
                        <p className="mt-1 text-[var(--ink-700)]">{formatPrice(unitPriceInr, currency)}</p>
                      </div>
                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Subtotal</p>
                        <p className="mt-1 text-[var(--ink-700)]">{formatPrice(lineTotalInr, currency)}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-400">Quantity</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(cartKey, quantity - 1)}
                          className="rounded-full border border-[var(--line-soft)] bg-white p-2"
                        >
                          <Image src={assets.decrease_arrow} alt="decrease_arrow" className="h-4 w-4" />
                        </button>
                        <input
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            const maxQuantity = Math.max(0, remainingStock);
                            updateCartQuantity(
                              cartKey,
                              Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), maxQuantity)
                            );
                          }}
                          type="number"
                          value={quantity}
                          className="w-full rounded border border-[var(--line-soft)] bg-white px-3 py-2 text-center appearance-none outline-none"
                        />
                        <button
                          onClick={() => {
                            const currentQty = quantity || 0;
                            if (currentQty < remainingStock) {
                              updateCartQuantity(cartKey, currentQty + 1);
                            } else {
                              toast.error(`Only ${remainingStock} items available in stock.`);
                            }
                          }}
                          className="rounded-full border border-[var(--line-soft)] bg-white p-2"
                        >
                          <Image src={assets.increase_arrow} alt="increase_arrow" className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Available: {remainingStock}</p>
                      {originalUnitPriceInr > unitPriceInr && (
                        <p className="mt-1 text-xs text-gray-400 line-through">
                          Original: {formatPrice(originalUnitPriceInr, currency)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full table-auto">
                  <thead className="text-left">
                    <tr>
                      <th className="text-nowrap pb-6 px-4 text-[var(--ink-500)] font-medium">Product Details</th>
                      <th className="pb-6 px-4 text-[var(--ink-500)] font-medium">Price</th>
                      <th className="pb-6 px-4 text-[var(--ink-500)] font-medium">Quantity</th>
                      <th className="pb-6 px-4 text-[var(--ink-500)] font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartEntries.map(({ cartKey, variantLabel, quantity, product, productImage, unitPriceInr, originalUnitPriceInr, remainingStock, lineTotalInr }) => (
                      <tr key={cartKey} className="border-t border-[var(--line-soft)]/70">
                        <td className="flex items-center gap-4 py-5 px-4">
                          <div className="cursor-pointer" onClick={() => router.push(`/product/${product._id}`)}>
                            <div className="rounded-[1.25rem] overflow-hidden bg-[var(--bg-soft)] p-3">
                              <Image
                                src={productImage || assets.box_icon}
                                alt={product.name}
                                className="w-16 h-auto object-cover mix-blend-multiply"
                                width={1280}
                                height={720}
                              />
                            </div>
                          </div>
                          <div className="text-sm">
                            <p className="text-[var(--ink-900)] font-semibold cursor-pointer" onClick={() => router.push(`/product/${product._id}`)}>
                              {product.name} {variantLabel ? `(${variantLabel})` : ""}
                            </p>
                            <p className="text-xs text-[var(--ink-500)] mt-1">Offer: {formatPrice(unitPriceInr, currency)}</p>
                            {originalUnitPriceInr > unitPriceInr && (
                              <p className="text-xs text-gray-400 line-through mt-1">
                                Original: {formatPrice(originalUnitPriceInr, currency)}
                              </p>
                            )}
                            <button
                              className="text-xs text-[var(--accent-strong)] mt-2"
                              onClick={() => updateCartQuantity(cartKey, 0)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-[var(--ink-700)]">{formatPrice(unitPriceInr, currency)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateCartQuantity(cartKey, quantity - 1)}>
                              <Image src={assets.decrease_arrow} alt="decrease_arrow" className="w-4 h-4" />
                            </button>
                            <input
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                const maxQuantity = Math.max(0, remainingStock);
                                updateCartQuantity(
                                  cartKey,
                                  Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), maxQuantity)
                                );
                              }}
                              type="number"
                              value={quantity}
                              className="w-10 border border-[var(--line-soft)] bg-white/80 rounded text-center appearance-none"
                            />
                            <button
                              onClick={() => {
                                const currentQty = quantity || 0;
                                if (currentQty < remainingStock) {
                                  updateCartQuantity(cartKey, currentQty + 1);
                                } else {
                                  toast.error(`Only ${remainingStock} items available in stock.`);
                                }
                              }}
                            >
                              <Image src={assets.increase_arrow} alt="increase_arrow" className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Available: {remainingStock}</p>
                        </td>
                        <td className="py-4 px-4 text-[var(--ink-700)]">{formatPrice(lineTotalInr, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => router.push('/all-products')}
                className="group mt-6 flex items-center gap-2 text-[var(--accent-strong)]"
              >
                <Image
                  className="transition group-hover:-translate-x-1"
                  src={assets.arrow_right_icon_colored}
                  alt="arrow_right_icon_colored"
                />
                Continue Shopping
              </button>
            </div>

            <div className="w-full lg:w-96">
              {cartEntries.length > 0 ? (
                <OrderSummary />
              ) : (
                <div className="flex h-full rounded-[1.5rem] border border-dashed border-[var(--line-soft)] bg-[var(--bg-soft)]/40 p-8 text-center text-[var(--ink-500)]">
                  <div className="m-auto">
                    <p className="mb-2 text-lg font-semibold text-[var(--ink-900)]">Your cart is empty</p>
                    <p className="text-sm">Add a few thoughtful finds to see your order summary and checkout options.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Cart;
