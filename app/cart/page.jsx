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
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";

const Cart = () => {
  const { products, productsLoading, router, cartItems, addToCart, updateCartQuantity, getCartCount, currency } = useAppContext();

  if (productsLoading) {
    return <Loading />;
  }

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 pt-10 pb-16">
        <div className="brand-surface rounded-[2rem] p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-[var(--line-soft)] pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--ink-500)] mb-2">SageCart bag</p>
              <h1 className="text-3xl md:text-4xl font-semibold text-[var(--ink-900)]">
                Your Cart
              </h1>
            </div>
            <p className="text-base md:text-lg text-[var(--ink-500)]">{getCartCount()} items selected</p>
          </div>

          <div className="flex flex-col md:flex-row gap-10">
            <div className="flex-1">
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead className="text-left">
                    <tr>
                      <th className="text-nowrap pb-6 md:px-4 px-1 text-[var(--ink-500)] font-medium">Product Details</th>
                      <th className="pb-6 md:px-4 px-1 text-[var(--ink-500)] font-medium">Price</th>
                      <th className="pb-6 md:px-4 px-1 text-[var(--ink-500)] font-medium">Quantity</th>
                      <th className="pb-6 md:px-4 px-1 text-[var(--ink-500)] font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(cartItems).map((itemId) => {
                      const product = products.find((item) => item._id === itemId);

                      if (!product || cartItems[itemId] <= 0) return null;

                      return (
                        <tr key={itemId} className="border-t border-[var(--line-soft)]/70">
                          <td className="flex items-center gap-4 py-5 md:px-4 px-1">
                            <div className="cursor-pointer" onClick={() => router.push(`/product/${product._id}`)}>
                              <div className="rounded-[1.25rem] overflow-hidden bg-[var(--bg-soft)] p-3">
                                <Image
                                  src={product.image[0]}
                                  alt={product.name}
                                  className="w-16 h-auto object-cover mix-blend-multiply"
                                  width={1280}
                                  height={720}
                                />
                              </div>
                            </div>
                            <div className="text-sm">
                              <p className="text-[var(--ink-900)] font-semibold cursor-pointer" onClick={() => router.push(`/product/${product._id}`)}>
                                {product.name}
                              </p>
                              <p className="text-xs text-[var(--ink-500)] mt-1">Offer: {formatPrice(convertUSDToINR(product.offerPrice), currency)}</p>
                              <button
                                className="text-xs text-[var(--accent-strong)] mt-2"
                                onClick={() => updateCartQuantity(product._id, 0)}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                          <td className="py-4 md:px-4 px-1 text-[var(--ink-700)]">{formatPrice(convertUSDToINR(product.offerPrice), currency)}</td>
                          <td className="py-4 md:px-4 px-1">
                            <div className="flex items-center md:gap-2 gap-1">
                              <button onClick={() => updateCartQuantity(product._id, cartItems[itemId] - 1)}>
                                <Image src={assets.decrease_arrow} alt="decrease_arrow" className="w-4 h-4" />
                              </button>
                              <input
                                onChange={(e) => {
                                  const value = Number(e.target.value)
                                  updateCartQuantity(
                                    product._id,
                                    Number.isNaN(value) ? 0 : Math.min(Math.max(value, 0), product.stock)
                                  )
                                }}
                                type="number"
                                value={cartItems[itemId]}
                                className="w-10 border border-[var(--line-soft)] bg-white/80 rounded text-center appearance-none"
                              />
                              <button
                                onClick={() => {
                                  const currentQty = cartItems[itemId] || 0
                                  if (currentQty < product.stock) {
                                    updateCartQuantity(product._id, currentQty + 1)
                                  } else {
                                    toast.error(`Only ${product.stock} items available in stock.`)
                                  }
                                }}
                              >
                                <Image src={assets.increase_arrow} alt="increase_arrow" className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Available: {product.stock}</p>
                          </td>
                          <td className="py-4 md:px-4 px-1 text-[var(--ink-700)]">{formatPrice(convertUSDToINR(product.offerPrice * cartItems[itemId]), currency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => router.push('/all-products')}
                className="group flex items-center mt-6 gap-2 text-[var(--accent-strong)]"
              >
                <Image
                  className="group-hover:-translate-x-1 transition"
                  src={assets.arrow_right_icon_colored}
                  alt="arrow_right_icon_colored"
                />
                Continue Shopping
              </button>
            </div>

            {getCartCount() > 0 ? (
              <OrderSummary />
            ) : (
              <div className="flex-1 h-full border border-dashed border-[var(--line-soft)] rounded-[1.5rem] p-8 text-center text-[var(--ink-500)] bg-[var(--bg-soft)]/40">
                <p className="text-lg font-semibold mb-2 text-[var(--ink-900)]">Your cart is empty</p>
                <p className="text-sm">Add a few thoughtful finds to see your order summary and checkout options.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Cart;
