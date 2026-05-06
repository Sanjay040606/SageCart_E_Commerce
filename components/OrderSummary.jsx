import { useAppContext } from "@/context/AppContext";
import { formatPrice } from "@/lib/currencyUtils";
import {
  getCartItemOriginalUnitPriceInr,
  getCartItemUnitPriceInr,
  parseCartKey
} from "@/lib/cartUtils";
import { getProductPrimaryImage, getProductVariantImage } from "@/lib/productDisplay";
import { getGamePromo, getUnusedUserGameCoupon, normalizePromoCode } from "@/lib/promoCodes";
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

const OrderSummary = () => {
  const {
    currency,
    router,
    getToken,
    user,
    userData,
    fetchUserData,
    products,
    cartItems,
    setCartItems
  } = useAppContext();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userAddresses, setUserAddresses] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const SHIPPING_DEFAULT = 50;
  const COUPON_DISCOUNT_RATE = 0.10;

  const fetchUserAddresses = useCallback(async () => {
    try {
      const token = await getToken();
      const { data } = await axios.get("/api/user/get-address", { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) {
        setUserAddresses(data.addresses);
        if (data.addresses.length > 0) {
          setSelectedAddress(data.addresses[0]);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [getToken]);

  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    setIsDropdownOpen(false);
  };

  const cartProducts = useMemo(() => {
    return Object.entries(cartItems)
      .map(([cartKey, qty]) => {
        const parsedKey = parseCartKey(cartKey);
        const product = products.find((item) => item._id === parsedKey.productId);
        const quantity = Number(qty) || 0;

        if (!product || quantity <= 0) return null;

        const unitPriceInr = getCartItemUnitPriceInr(product, parsedKey);
        const originalUnitPriceInr = getCartItemOriginalUnitPriceInr(product, parsedKey);
        const variantImage = getProductVariantImage(product, parsedKey);
        const productImage = variantImage || getProductPrimaryImage(product);

        return {
          ...product,
          quantity,
          cartKey,
          variantId: parsedKey.variantId,
          variantLabel: parsedKey.variantLabel,
          variantType: parsedKey.variantType,
          variantPriceInr: parsedKey.variantPriceInr ?? unitPriceInr,
          variantOriginalPriceInr: parsedKey.variantOriginalPriceInr ?? originalUnitPriceInr,
          productImage,
          promoCode: product.promoCode || "",
          unitPriceInr,
          originalUnitPriceInr,
          lineTotalInr: Math.round(unitPriceInr * quantity),
          originalLineTotalInr: Math.round(originalUnitPriceInr * quantity),
          shippingFee: SHIPPING_DEFAULT
        };
      })
      .filter(Boolean);
  }, [cartItems, products]);

  const originalSubTotal = useMemo(
    () => cartProducts.reduce((acc, item) => acc + item.originalLineTotalInr, 0),
    [cartProducts]
  );

  const offerSubTotal = useMemo(
    () => cartProducts.reduce((acc, item) => acc + item.lineTotalInr, 0),
    [cartProducts]
  );

  const totalShippingFee = useMemo(
    () => cartProducts.reduce((acc, item) => acc + item.shippingFee, 0),
    [cartProducts]
  );

  const promoCodeNormalized = normalizePromoCode(promoCode);
  const gamePromo = getGamePromo(promoCodeNormalized);
  const userGameCoupon = getUnusedUserGameCoupon(userData, promoCodeNormalized);
  const validFreeShipping = gamePromo?.type === "shipping";
  const validProductPromo = cartProducts.some(
    (item) => item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized
  );

  const productPromoDiscount = useMemo(() => {
    if (promoStatus !== "success" || !validProductPromo) return 0;

    return cartProducts.reduce((acc, item) => {
      if (item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized) {
        return acc + Math.round(item.lineTotalInr * COUPON_DISCOUNT_RATE);
      }
      return acc;
    }, 0);
  }, [cartProducts, promoCodeNormalized, promoStatus, validProductPromo]);

  const gamePromoDiscount = useMemo(() => {
    if (promoStatus !== "success" || gamePromo?.type !== "percent") return 0;
    return Math.round(offerSubTotal * (gamePromo.value / 100));
  }, [gamePromo, offerSubTotal, promoStatus]);

  const validPromo = promoStatus === "success" && (validFreeShipping || validProductPromo || Boolean(userGameCoupon));
  const discount = validProductPromo ? productPromoDiscount : gamePromoDiscount;

  const shippingDiscount = useMemo(() => {
    if (promoStatus !== "success" || !validPromo) return 0;

    return cartProducts.reduce((acc, item) => {
      if (validFreeShipping) {
        return acc + item.shippingFee;
      }

      if (item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized) {
        return acc + item.shippingFee;
      }

      return acc;
    }, 0);
  }, [cartProducts, promoCodeNormalized, promoStatus, validFreeShipping, validPromo]);

  const effectiveShippingFee = totalShippingFee - shippingDiscount;
  const paymentDiscount = paymentMethod === "UPI" || paymentMethod === "CARD" ? 60 : 0;
  const totalAmount = offerSubTotal - discount + effectiveShippingFee - paymentDiscount;

  const applyPromoCode = () => {
    if (!promoCode.trim()) {
      setPromoStatus("error");
      setPromoMessage("Please enter a promo code");
      return;
    }

    const normalizedCode = normalizePromoCode(promoCode);
    const promo = getGamePromo(normalizedCode);
    const gameCoupon = getUnusedUserGameCoupon(userData, normalizedCode);
    const shippingValid = promo?.type === "shipping" && Boolean(gameCoupon);
    const productPromoValid = cartProducts.some(
      (item) => item.promoCode && item.promoCode.toUpperCase() === normalizedCode
    );

    if (shippingValid) {
      setPromoStatus("success");
      setPromoMessage(`Free shipping code applied: ${normalizedCode}`);
    } else if (promo?.type === "message") {
      setPromoStatus("info");
      setPromoMessage(`🍀 ${promo.label} - Try again in the next game!`);
    } else if (promo?.type === "percent" && gameCoupon) {
      setPromoStatus("success");
      setPromoMessage(`Game reward applied: ${normalizedCode} for ${promo.value}% off the order`);
    } else if (productPromoValid) {
      setPromoStatus("success");
      setPromoMessage(`Promo code applied: ${normalizedCode}. Discount applied for matched product(s)`);
    } else {
      setPromoStatus("error");
      setPromoMessage("Invalid promo code");
    }
  };

  const createOrder = async () => {
    if (submittingOrder) return;

    try {
      setSubmittingOrder(true);

      if (!selectedAddress) {
        return toast.error("Please select an address");
      }

      const cartItemsArray = cartProducts
        .map((item) => {
          const productId = String(item._id ?? "").trim();
          if (!productId) return null;

          return {
            product: productId,
            productId,
            quantity: item.quantity,
            color: item.variantLabel,
            variantLabel: item.variantLabel,
            variantType: item.variantType,
            variantId: item.variantId,
            variantPriceInr: item.unitPriceInr,
            variantOriginalPriceInr: item.originalUnitPriceInr,
            offerPriceInr: item.unitPriceInr,
            originalPriceInr: item.originalUnitPriceInr,
            productName: item.name || "",
            productImage: item.productImage
          };
        })
        .filter((item) => item && item.quantity > 0);

      if (cartItemsArray.length === 0) {
        return toast.error("Cart is empty");
      }

      const detailedInvoiceItems = cartProducts
        .map((item) => {
          const productId = String(item._id ?? "").trim();
          if (!productId) return null;

          return {
            product: productId,
            productId,
            productName: item.name,
            productImage: item.productImage,
            color: item.variantLabel,
            variantLabel: item.variantLabel,
            variantType: item.variantType,
            variantId: item.variantId,
            quantity: item.quantity,
            offerPriceInr: Math.round(item.unitPriceInr),
            originalPriceInr: Math.round(item.originalUnitPriceInr),
            shippingFee: item.shippingFee,
            promoCode: item.promoCode || ""
          };
        })
        .filter(Boolean);

      if (paymentMethod === "UPI" || paymentMethod === "CARD") {
        const paymentData = {
          address: selectedAddress,
          items: cartItemsArray,
          invoiceItems: detailedInvoiceItems,
          subTotalInr: originalSubTotal,
          offerSubTotalInr: offerSubTotal,
          shippingInr: effectiveShippingFee,
          discountInr: discount,
          paymentDiscountInr: paymentDiscount,
          totalInr: totalAmount,
          promoCode: normalizePromoCode(promoCode),
          paymentMethod
        };
        localStorage.setItem("sagecart-payment-data", JSON.stringify(paymentData));
        router.push("/payment");
        return;
      }

      const token = await getToken();
      const { data } = await axios.post(
        "/api/order/create",
        {
          address: selectedAddress._id,
          items: cartItemsArray,
          promoCode: normalizePromoCode(promoCode),
          paymentMethod
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (data.success) {
        toast.success(data.message);

        const payloadForInvoice = {
          order: data.order,
          address: selectedAddress,
          items: detailedInvoiceItems,
          subTotalInr: originalSubTotal,
          offerSubTotalInr: offerSubTotal,
          shippingInr: effectiveShippingFee,
          discountInr: discount,
          paymentDiscountInr: paymentDiscount,
          totalInr: totalAmount,
          promoCode: validPromo ? promoCodeNormalized : "",
          paymentMethod,
          placedAt: new Date().toLocaleString()
        };

        localStorage.setItem("sagecart-last-order", JSON.stringify(payloadForInvoice));

        setCartItems({});
        await fetchUserData();
        router.push("/order-placed");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const unavailableProducts = error.response?.data?.unavailableProducts;

      if (unavailableProducts?.length) {
        unavailableProducts.forEach((item) => {
          const productLabel = item.productName || item.productId || "Item";
          toast.error(`${productLabel}: ${item.reason}${item.available != null ? ` (available: ${item.available})` : ""}`);
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserAddresses();
    }
  }, [fetchUserAddresses, user]);

  if (cartProducts.length === 0) {
    return (
      <div className="w-full md:w-96 bg-gray-500/5 p-5 text-center text-gray-500">
        <h2 className="text-xl font-medium mb-2">Order Summary</h2>
        <p>Your cart is empty. Add items to view order summary.</p>
      </div>
    );
  }

  return (
    <div className="w-full md:w-96 bg-gray-500/5 p-5">
      <h2 className="text-xl md:text-2xl font-medium text-gray-700">
        Order Summary
      </h2>
      <hr className="border-gray-500/30 my-5" />
      <div className="space-y-6">
        <div>
          <label className="text-base font-medium uppercase text-gray-600 block mb-2">
            Select Address
          </label>
          <div className="relative inline-block w-full text-sm border">
            <button
              className="peer w-full text-left px-4 pr-2 py-2 bg-white text-gray-700 focus:outline-none"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span>
                {selectedAddress
                  ? `${selectedAddress.fullName}, ${selectedAddress.area}, ${selectedAddress.city}, ${selectedAddress.state}`
                  : "Select Address"}
              </span>
              <svg
                className={`w-5 h-5 inline float-right transition-transform duration-200 ${isDropdownOpen ? "rotate-0" : "-rotate-90"}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#6B7280"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <ul className="absolute w-full bg-white border shadow-md mt-1 z-10 py-1.5">
                {userAddresses.map((address, index) => (
                  <li
                    key={index}
                    className="px-4 py-2 hover:bg-gray-500/10 cursor-pointer"
                    onClick={() => handleAddressSelect(address)}
                  >
                    {address.fullName}, {address.area}, {address.city}, {address.state}
                  </li>
                ))}
                <li
                  onClick={() => router.push("/add-address")}
                  className="px-4 py-2 hover:bg-gray-500/10 cursor-pointer text-center"
                >
                  + Add New Address
                </li>
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white border p-3 rounded-md">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Items review</h3>
          <div className="space-y-2 text-sm">
            {cartProducts.map((item) => (
              <div key={item.cartKey} className="flex justify-between items-start border-b pb-2 last:border-b-0">
                <div>
                  <p className="text-gray-700 font-medium">
                    {item.name} {item.variantLabel ? `(${item.variantLabel})` : ""} × {item.quantity}
                  </p>
                  <p className="text-xs text-gray-500">
                    Original: {formatPrice(item.originalUnitPriceInr, currency)} | Offer: {formatPrice(item.unitPriceInr, currency)}
                  </p>
                  {item.promoCode && (
                    <p className="text-xs text-green-600">Coupon: {item.promoCode}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{formatPrice(item.lineTotalInr, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-base font-medium uppercase text-gray-600 block mb-2">
            Promo Code <span className="text-gray-500 text-sm normal-case">(Optional)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter promo code"
              className="flex-grow md:flex-1 w-full outline-none p-2.5 text-gray-600 border"
            />
            <button
              onClick={applyPromoCode}
              className="brand-button px-5 py-2"
            >
              Apply
            </button>
          </div>
          {promoMessage && (
            <p className={`mt-2 text-sm ${promoStatus === "success" ? "text-green-700" : promoStatus === "info" ? "text-blue-600" : "text-red-700"}`}>
              {promoMessage}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Enter the promo code provided by the seller for 10% discount on that specific product. Each product may have its own unique code.
          </p>
        </div>

        <hr className="border-gray-500/30 my-5" />

        <div className="space-y-4">
          <div className="flex justify-between text-base font-medium">
            <p className="uppercase text-gray-600">Original Total</p>
            <p className="text-gray-800">{formatPrice(originalSubTotal, currency)}</p>
          </div>
          <div className="flex justify-between text-base font-medium">
            <p className="uppercase text-gray-600">Offer Total</p>
            <p className="text-gray-800">{formatPrice(offerSubTotal, currency)}</p>
          </div>
          <div className="flex justify-between text-base font-medium">
            <p className="text-gray-600">You save</p>
            <p className="font-medium text-green-600">-{formatPrice(originalSubTotal - offerSubTotal, currency)}</p>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-base font-medium">
              <p className="text-gray-600">Coupon Discount</p>
              <p className="font-medium text-green-600">-{formatPrice(discount, currency)}</p>
            </div>
          )}
          <div className="flex justify-between">
            <p className="text-gray-600">Shipping Fee</p>
            <p className="font-medium text-gray-800">
              {effectiveShippingFee === 0 ? "Free" : formatPrice(effectiveShippingFee, currency)}
            </p>
          </div>
          {(paymentMethod === "UPI" || paymentMethod === "CARD") && (
            <div className="flex justify-between text-base font-medium text-green-600">
              <p>UPI/Card Discount</p>
              <p>-{formatPrice(paymentDiscount, currency)}</p>
            </div>
          )}
          <div className="flex justify-between text-lg md:text-xl font-semibold border-t pt-3">
            <p>Total</p>
            <p>{formatPrice(totalAmount, currency)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-600 mb-1">Payment Method</label>
        <select
          className="w-full border p-2 rounded"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="COD">Cash on Delivery</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
        </select>
      </div>
      <button
        onClick={createOrder}
        disabled={submittingOrder}
        className="brand-button w-full py-3 mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submittingOrder ? "Placing Order..." : "Place Order"}
      </button>
    </div>
  );
};

export default OrderSummary;
