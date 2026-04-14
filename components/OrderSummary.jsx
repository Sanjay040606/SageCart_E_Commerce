import { addressDummyData } from "@/assets/assets";
import { useAppContext } from "@/context/AppContext";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import { getGamePromo, getUnusedUserGameCoupon, normalizePromoCode } from "@/lib/promoCodes";
import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

const OrderSummary = () => {

  const { currency, router, getCartCount, getCartAmount, getToken, user, userData, fetchUserData, products, cartItems, setCartItems } = useAppContext()
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [userAddresses, setUserAddresses] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState(null); // 'success' or 'error'
  const [promoMessage, setPromoMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const SHIPPING_DEFAULT = 50;

  const fetchUserAddresses = useCallback(async () => {
    try {
      
      const token = await getToken()
      const {data} = await axios.get('/api/user/get-address', {headers: {Authorization: `Bearer ${token}`}})
      if (data.success) {
        setUserAddresses(data.addresses)
        if(data.addresses.length > 0) {
          setSelectedAddress(data.addresses[0])
        }
      } else {
        toast.error(data.message)
      }

    } catch (error) {
      toast.error(error.message)
    }
  }, [getToken])

  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    setIsDropdownOpen(false);
  };

  const COUPON_DISCOUNT_RATE = 0.10;

  const cartProducts = Object.entries(cartItems)
    .map(([productId, qty]) => {
      const product = products.find((item) => item._id === productId);
      if (!product || qty <= 0) return null;
      return {
        ...product,
        quantity: qty,
        promoCode: product.promoCode || "",
        lineTotalInr: Math.round(convertUSDToINR(product.offerPrice * qty)),
        originalLineTotalInr: Math.round(convertUSDToINR(product.price * qty)),
        shippingFee: 50, // Each product has its own shipping fee
      };
    })
    .filter(Boolean);

  const originalSubTotal = cartProducts.reduce((acc, item) => acc + item.originalLineTotalInr, 0);
  const offerSubTotal = cartProducts.reduce((acc, item) => acc + item.lineTotalInr, 0);

  // Calculate total shipping fee (50 per product)
  const totalShippingFee = cartProducts.reduce((acc, item) => acc + item.shippingFee, 0);

  const promoCodeNormalized = normalizePromoCode(promoCode);
  const gamePromo = getGamePromo(promoCodeNormalized);
  const userGameCoupon = getUnusedUserGameCoupon(userData, promoCodeNormalized);
  const validFreeShipping = gamePromo?.type === 'shipping';

  const validProductPromo = cartProducts.some(item => item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized);

  // Only apply coupon discount if promo code has been applied (clicked Apply button)
  const productPromoDiscount = (promoStatus === 'success' && validProductPromo) ? cartProducts.reduce((acc, item) => {
    if (item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized) {
      return acc + Math.round(item.lineTotalInr * COUPON_DISCOUNT_RATE);
    }
    return acc;
  }, 0) : 0;

  const gamePromoDiscount = (promoStatus === 'success' && gamePromo?.type === 'percent')
    ? Math.round(offerSubTotal * (gamePromo.value / 100))
    : 0;

  const validPromo = promoStatus === 'success' && (validFreeShipping || validProductPromo || Boolean(userGameCoupon));

  const discount = validProductPromo ? productPromoDiscount : gamePromoDiscount;
  
  // Shipping fee reduction only for products with valid coupon
  const shippingDiscount = (promoStatus === 'success' && validPromo) ? 
    cartProducts.reduce((acc, item) => {
      if (validFreeShipping) {
        return acc + item.shippingFee;
      }
      if (item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized) {
        return acc + item.shippingFee;
      }
      return acc;
    }, 0) : 0;

  const effectiveShippingFee = totalShippingFee - shippingDiscount;
  
  // Add UPI/Card discount for prepaid methods
  const paymentDiscount = (paymentMethod === 'UPI' || paymentMethod === 'CARD') ? 60 : 0;
  const totalAmount = offerSubTotal - discount + effectiveShippingFee - paymentDiscount;

  const applyPromoCode = () => {
    if (!promoCode.trim()) {
      setPromoStatus('error');
      setPromoMessage('Please enter a promo code');
      return;
    }

    const promoCodeNormalized = normalizePromoCode(promoCode);
    const gamePromo = getGamePromo(promoCodeNormalized);
    const userGameCoupon = getUnusedUserGameCoupon(userData, promoCodeNormalized);
    const validFreeShipping = gamePromo?.type === 'shipping' && Boolean(userGameCoupon);
    const validProductPromo = cartProducts.some(item => item.promoCode && item.promoCode.toUpperCase() === promoCodeNormalized);

    if (validFreeShipping) {
      setPromoStatus('success');
      setPromoMessage(`Free shipping code applied: ${promoCodeNormalized}`);
    } else if (gamePromo?.type === 'message') {
      setPromoStatus('info');
      setPromoMessage(`🍀 ${gamePromo.label} - Try again in the next game!`);
    } else if (gamePromo?.type === 'percent' && userGameCoupon) {
      setPromoStatus('success');
      setPromoMessage(`Game reward applied: ${promoCodeNormalized} for ${gamePromo.value}% off the order`);
    } else if (validProductPromo) {
      setPromoStatus('success');
      setPromoMessage(`Promo code applied: ${promoCodeNormalized}. Discount applied for matched product(s)`);
    } else {
      setPromoStatus('error');
      setPromoMessage('Invalid promo code');
    }
  };

  const createOrder = async () => {
    if (submittingOrder) return

    try {
      setSubmittingOrder(true)

      if (!selectedAddress) {
        return toast.error('Please select an address')
      }

      let cartItemsArray = Object.keys(cartItems).map((key) => ({product:key, quantity:cartItems[key]}))
      cartItemsArray = cartItemsArray.filter(item => item.quantity > 0)

      if (cartItemsArray.length === 0) {
        return toast.error('Cart is empty')
      }

      const detailedInvoiceItems = cartProducts.map((item) => ({
        product: item._id,
        productName: item.name,
        quantity: item.quantity,
        offerPriceInr: Math.round(item.lineTotalInr / item.quantity),
        shippingFee: item.shippingFee,
        promoCode: item.promoCode || ''
      }))

      // If payment method is UPI or CARD, redirect to payment page
      if (paymentMethod === 'UPI' || paymentMethod === 'CARD') {
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
          paymentMethod: paymentMethod
        }
        localStorage.setItem('sagecart-payment-data', JSON.stringify(paymentData))
        router.push('/payment')
        return
      }

      // If COD, create order directly
      const token = await getToken()

      const { data } = await axios.post('/api/order/create',{
        address: selectedAddress._id,
        items: cartItemsArray,
        promoCode: normalizePromoCode(promoCode),
        paymentMethod
      },{
        headers:{Authorization: `Bearer ${token}`}
      })

      if (data.success) {
        toast.success(data.message)

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
          paymentMethod: paymentMethod,
          placedAt: new Date().toLocaleString()
        };

        localStorage.setItem('sagecart-last-order', JSON.stringify(payloadForInvoice));

        setCartItems({})
        await fetchUserData()
        router.push('/order-placed')
      } else {
        toast.error(data.message)
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message
      const unavailableProducts = error.response?.data?.unavailableProducts

      if (unavailableProducts?.length) {
        unavailableProducts.forEach((item) => {
          const productLabel = item.productName || item.productId || 'Item'
          toast.error(`${productLabel}: ${item.reason}${item.available != null ? ` (available: ${item.available})` : ''}`)
        })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setSubmittingOrder(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchUserAddresses();
    }
  }, [fetchUserAddresses, user])

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
              <svg className={`w-5 h-5 inline float-right transition-transform duration-200 ${isDropdownOpen ? "rotate-0" : "-rotate-90"}`}
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#6B7280"
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

        {cartProducts.length > 0 && (
          <div className="bg-white border p-3 rounded-md">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Items review</h3>
            <div className="space-y-2 text-sm">
              {cartProducts.map((item) => (
                <div key={item._id} className="flex justify-between items-start border-b pb-2 last:border-b-0">
                  <div>
                    <p className="text-gray-700 font-medium">{item.name} × {item.quantity}</p>
                    <p className="text-xs text-gray-500">
                      Original: {formatPrice(convertUSDToINR(item.price), currency)} | 
                      Offer: {formatPrice(convertUSDToINR(item.offerPrice), currency)}
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
        )}

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
            <p className={`mt-2 text-sm ${promoStatus === 'success' ? 'text-green-700' : promoStatus === 'info' ? 'text-blue-600' : 'text-red-700'}`}>
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
              {effectiveShippingFee === 0 ? 'Free' : formatPrice(effectiveShippingFee, currency)}
            </p>
          </div>
          {(paymentMethod === 'UPI' || paymentMethod === 'CARD') && (
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
        {submittingOrder ? 'Placing Order...' : 'Place Order'}
      </button>
    </div>
  );
};

export default OrderSummary;

