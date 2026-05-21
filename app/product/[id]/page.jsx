"use client"
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { assets } from "@/assets/assets";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import Loading from "@/components/Loading";
import { useAppContext } from "@/context/AppContext";
import { useClerk } from "@clerk/nextjs";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import { resolveOrderProductId } from "@/lib/orderUtils";
import toast from "react-hot-toast";
import {
  buildDatasetReviewCards,
  buildProductVariantOptions,
  getProductAvailabilitySummary,
  getProductVariantGalleryEntries,
  getDatasetReviewHighlights,
  getProductAverageRating,
  getProductPrimaryImage,
  getProductReviewCount,
  getVariantDisplayDescription,
  getVariantDisplayImage,
  getVariantDisplayPriceInr,
  getVariantDisplayOriginalPriceInr,
  isVariantUnavailable,
  normalizeProductImageUrl
} from "@/lib/productDisplay";
import { dedupeCatalogProducts } from "@/lib/productCatalog";

const RELATED_PRODUCTS_PER_PAGE = 6;

const isManualCatalogProduct = (product = {}) =>
  String(product?.source || product?.datasetMeta?.source || "").trim().toLowerCase() === "manual";

const Product = () => {
  const { id } = useParams();
  const { products, router, addToCart, currency, user, wishlistItems, toggleWishlist } = useAppContext();
  const resolvedProductId = resolveOrderProductId(id);
  const productId = resolvedProductId || id;
  const isWishlisted = wishlistItems?.includes(productId);
  const { openSignIn, loaded: clerkLoaded } = useClerk();

  const [mainImage, setMainImage] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [detailProduct, setDetailProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [relatedPage, setRelatedPage] = useState(1);

  const getStatusDisplay = (status, stock) => {
    switch (status) {
      case "out_of_stock":
        return { text: "Out of Stock", color: "text-red-600", bgColor: "bg-red-50" };
      case "low_stock":
        return { text: `Only ${stock} left in stock`, color: "text-[var(--accent-strong)]", bgColor: "bg-[var(--accent-tint)]" };
      case "inactive":
        return { text: "Currently Unavailable", color: "text-gray-600", bgColor: "bg-gray-50" };
      default:
        return null;
    }
  };

  const catalogProducts = useMemo(() => dedupeCatalogProducts(products), [products]);
  const summaryProduct = useMemo(
    () => catalogProducts.find((item) => String(item._id) === String(productId)) || null,
    [catalogProducts, productId]
  );
  const resolvedDetailProduct = detailProduct && String(detailProduct._id) === String(productId) ? detailProduct : null;
  const summaryAvailability = useMemo(() => getProductAvailabilitySummary(summaryProduct || {}), [summaryProduct]);
  const detailAvailability = useMemo(() => getProductAvailabilitySummary(resolvedDetailProduct || {}), [resolvedDetailProduct]);
  const shouldPreferSummaryProduct = Boolean(
    summaryProduct &&
      resolvedDetailProduct &&
      String(summaryProduct._id) !== String(resolvedDetailProduct._id) &&
      isManualCatalogProduct(summaryProduct) &&
      (
        !isManualCatalogProduct(resolvedDetailProduct) ||
        (detailAvailability.status === "out_of_stock" && summaryAvailability.status !== "out_of_stock")
      )
  );
  const productData = shouldPreferSummaryProduct ? summaryProduct : (resolvedDetailProduct || summaryProduct);

  const galleryEntries = useMemo(
    () => getProductVariantGalleryEntries(productData || {}),
    [productData]
  );

  const variantOptions = useMemo(() => buildProductVariantOptions(productData || {}), [productData]);

  const selectedVariant = useMemo(() => {
    if (!variantOptions.length) return null;
    return (
      variantOptions.find((option) => option.id === selectedVariantId) ||
      variantOptions.find((option) => !isVariantUnavailable(option)) ||
      variantOptions[0]
    );
  }, [selectedVariantId, variantOptions]);

  const selectedVariantImage = useMemo(() => {
    if (!productData || !selectedVariant) return "";

    const galleryMatch = galleryEntries.find((entry) => entry.variantId === selectedVariant.id);
    return normalizeProductImageUrl(
      galleryMatch?.image ||
      getVariantDisplayImage(productData, selectedVariant) ||
      getProductPrimaryImage(productData) ||
      ""
    );
  }, [galleryEntries, productData, selectedVariant]);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);

    axios
      .get(`/api/product/${productId}`)
      .then(({ data }) => {
        if (!cancelled && data.success) {
          setDetailProduct(data.product);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailProduct(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!productData) return;

    const initialVariant = variantOptions.find((option) => !isVariantUnavailable(option)) || variantOptions[0];

    if (variantOptions.length === 0) {
      setSelectedVariantId("");
    } else if (!selectedVariantId || !variantOptions.some((option) => option.id === selectedVariantId)) {
      setSelectedVariantId(initialVariant?.id || "");
    }
  }, [productData, selectedVariantId, variantOptions]);

  useEffect(() => {
    setRelatedPage(1);
  }, [productId]);

  useEffect(() => {
    if (!productData) return;

    setMainImage(
      selectedVariantImage ||
      normalizeProductImageUrl(galleryEntries[0]?.image || getProductPrimaryImage(productData) || "")
    );
  }, [galleryEntries, productData, selectedVariantImage]);

  const reviews = Array.isArray(productData?.reviews) ? productData.reviews : [];
  const displayedReviews = reviews.length > 0 ? reviews : buildDatasetReviewCards(productData || {});
  const reviewHighlights = getDatasetReviewHighlights(productData || {});
  const averageRating = getProductAverageRating(productData || {});
  const reviewCount = getProductReviewCount(productData || {});
  const availability = getProductAvailabilitySummary(productData || {});
  const selectedVariantUnavailable = isVariantUnavailable(selectedVariant);
  const statusInfo = productData
    ? getStatusDisplay(selectedVariantUnavailable ? "out_of_stock" : availability.status, selectedVariantUnavailable ? 0 : availability.stock)
    : null;
  const isAvailable = Boolean(
    productData &&
      (availability.status === "active" || availability.status === "low_stock") &&
      !selectedVariantUnavailable
  );
  const baseOfferPriceInr = productData ? convertUSDToINR(productData.offerPrice) : 0;
  const baseOriginalPriceInr = productData ? convertUSDToINR(productData.price) : 0;
  const variantOfferPriceInr = selectedVariant ? getVariantDisplayPriceInr(productData, selectedVariant) : null;
  const displayPriceInr = variantOfferPriceInr || baseOfferPriceInr;
  const displayOriginalPriceInr = selectedVariant?.originalPriceInr || baseOriginalPriceInr;
  const brandDisplay = productData?.brand || productData?.datasetMeta?.brand || "Brand not set";
  const variantLabel = selectedVariant?.label || "";
  const variantDescription = selectedVariant ? getVariantDisplayDescription(productData, selectedVariant) : "";
  const variantTypeLabel = selectedVariant?.type === "color"
    ? "Select Color"
    : selectedVariant?.type === "size"
      ? "Select Size"
      : selectedVariant?.type === "storage"
        ? "Select Storage"
      : "Choose Variant";
  const relatedProducts = useMemo(
    () => catalogProducts.filter((product) => String(product._id) !== String(productId)),
    [catalogProducts, productId]
  );
  const totalRelatedPages = Math.max(1, Math.ceil(relatedProducts.length / RELATED_PRODUCTS_PER_PAGE));
  const safeRelatedPage = Math.min(relatedPage, totalRelatedPages);
  const visibleRelatedProducts = useMemo(
    () => {
      const startIndex = (safeRelatedPage - 1) * RELATED_PRODUCTS_PER_PAGE;
      return relatedProducts.slice(startIndex, startIndex + RELATED_PRODUCTS_PER_PAGE);
    },
    [relatedProducts, safeRelatedPage]
  );
  const relatedStart = relatedProducts.length === 0 ? 0 : ((safeRelatedPage - 1) * RELATED_PRODUCTS_PER_PAGE) + 1;
  const relatedEnd = relatedProducts.length === 0 ? 0 : Math.min(safeRelatedPage * RELATED_PRODUCTS_PER_PAGE, relatedProducts.length);

  useEffect(() => {
    if (relatedPage > totalRelatedPages) {
      setRelatedPage(totalRelatedPages);
    }
  }, [relatedPage, totalRelatedPages]);

  const addSelectedProductToCart = () => {
    if (!isAvailable) {
      toast.error(selectedVariantUnavailable ? "This variant is currently unavailable." : "This product is currently unavailable.");
      return;
    }

    if (variantOptions.length > 0 && !selectedVariant) {
      toast.error("Please select a variant first.");
      return;
    }

    addToCart(productData._id, selectedVariant?.label || "", {
      ...selectedVariant,
      variantImage: normalizeProductImageUrl(mainImage || selectedVariantImage || getVariantDisplayImage(productData, selectedVariant))
    });
  };

  if (!productData) {
    return (
      <>
        <Navbar />
        {detailLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center px-6 py-24 md:min-h-[60vh] md:px-16 lg:px-32">
            <Loading />
          </div>
        ) : (
          <div className="px-6 md:px-16 lg:px-32 py-24">
            <div className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--line-soft)] bg-white p-10 text-center shadow-sm">
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--ink-500)]">Product unavailable</p>
              <h1 className="mt-3 text-3xl font-semibold text-[var(--ink-900)]">We could not find this product.</h1>
              <p className="mt-3 text-[var(--ink-500)]">
                The product may have been removed, or the catalog is still syncing. Please go back to the shop and try again.
              </p>
              <button
                type="button"
                onClick={() => router.push("/all-products")}
                className="brand-button mt-6 px-6 py-3"
              >
                Back to shop
              </button>
            </div>
          </div>
        )}
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 pt-14 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <div className="px-5 lg:px-16 xl:px-20">
            <div className="rounded-lg overflow-hidden bg-gray-500/10 mb-4">
              <Image
                src={mainImage || assets.box_icon}
                alt={productData.name}
                className="w-full h-auto object-cover mix-blend-multiply"
                width={1280}
                height={720}
              />
            </div>

            {galleryEntries.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {galleryEntries.slice(0, 8).map(({ image, variantId }, index) => {
                  const galleryImage = normalizeProductImageUrl(image);

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setMainImage(galleryImage);
                        if (variantId) {
                          setSelectedVariantId(variantId);
                        }
                      }}
                      className={`cursor-pointer rounded-lg overflow-hidden bg-gray-500/10 ${mainImage === galleryImage ? "ring-2 ring-[var(--accent-strong)]" : ""}`}
                    >
                      <Image
                        src={galleryImage}
                        alt={`${productData.name} ${index + 1}`}
                        className="w-full h-auto object-cover mix-blend-multiply"
                        width={1280}
                        height={720}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-medium text-gray-800/90 mb-4">
                {productData.name}
              </h1>
              {statusInfo && (
                <div className={`px-4 py-2 rounded-lg text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
                  {statusInfo.text}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Image
                    key={idx}
                    className="h-4 w-4"
                    src={idx < Math.round(averageRating || 0) ? assets.star_icon : assets.star_dull_icon}
                    alt="star_icon"
                  />
                ))}
              </div>
              <p>
                ({averageRating || "New"}) <span className="text-sm text-gray-500 ml-1">• {reviewCount} verified reviews</span>
              </p>
            </div>

            <p className="text-gray-600 mt-3">
              {variantDescription || productData.description}
            </p>

            <p className="text-3xl font-medium mt-6">
              {formatPrice(displayPriceInr, currency)}
              {displayOriginalPriceInr > displayPriceInr && (
                <span className="text-base font-normal text-gray-800/60 line-through ml-2">
                  {formatPrice(displayOriginalPriceInr, currency)}
                </span>
              )}
            </p>

            {reviewHighlights.length > 0 && (
              <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-white p-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">What customers said</p>
                <div className="flex flex-wrap gap-2">
                  {reviewHighlights.slice(0, 6).map((highlight, index) => (
                    <span key={`${highlight}-${index}`} className="rounded-full bg-[var(--accent-tint)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <hr className="bg-gray-600 my-6" />

            <div className="overflow-x-auto">
              <table className="table-auto border-collapse w-full max-w-72">
                <tbody>
                  <tr>
                    <td className="text-gray-600 font-medium">Brand</td>
                    <td className="text-gray-800/50 ">{brandDisplay}</td>
                  </tr>
                  {galleryEntries.length > 0 && (
                    <tr>
                      <td className="text-gray-600 font-medium">Images</td>
                      <td className="text-gray-800/50 ">{galleryEntries.length}</td>
                    </tr>
                  )}
                  {variantLabel && (
                    <tr>
                      <td className="text-gray-600 font-medium">{variantTypeLabel}</td>
                      <td className="text-gray-800/50 ">{variantLabel}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-gray-600 font-medium">Category</td>
                    <td className="text-gray-800/50">
                      {productData.category}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {variantOptions.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-semibold mb-2">{variantTypeLabel}</p>
                <div className="flex gap-2 flex-wrap">
                  {variantOptions.map((option, index) => {
                    const optionPrice = getVariantDisplayPriceInr(productData, option);
                    const optionOriginalPrice = getVariantDisplayOriginalPriceInr(productData, option);
                    const isSelected = selectedVariant?.id === option.id;
                    const optionUnavailable = isVariantUnavailable(option);
                    return (
                      <button
                        key={`${option.id || "variant"}-${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(option.id);
                          setMainImage(normalizeProductImageUrl(getVariantDisplayImage(productData, option)));
                        }}
                        className={`flex min-w-[11rem] flex-col items-start gap-0.5 px-4 py-2 border rounded-2xl text-left text-sm transition ${
                          isSelected
                            ? optionUnavailable
                              ? "border-red-400 bg-red-50 text-red-600"
                              : "border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--accent-strong)]"
                            : optionUnavailable
                              ? "border-red-200 text-red-500 bg-red-50/40 hover:bg-red-50"
                              : "border-gray-300 hover:bg-gray-50"
                        }`}
                        >
                        <span className="font-medium">{option.label}</span>
                        {optionUnavailable && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-red-500">Out of stock</span>
                        )}
                        {optionPrice ? (
                          <span className="flex items-baseline gap-1 text-xs">
                            <span className="font-semibold">{formatPrice(optionPrice, currency)}</span>
                            {optionOriginalPrice && optionOriginalPrice > optionPrice && (
                              <span className="text-[10px] text-gray-500 line-through">
                                {formatPrice(optionOriginalPrice, currency)}
                              </span>
                            )}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-[var(--line-soft)] rounded p-3 mt-5">
              <p className="text-sm font-semibold">Product Promo Code</p>
              <p className="text-gray-700">{productData.promoCode || "No promo code available"}</p>
              <p className="text-xs text-gray-500 mt-1">Use this code at checkout for 10% off this product plus free shipping</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-3 mt-3">
              <p className="text-sm font-semibold text-green-800">💳 Payment Discount Offer</p>
              <p className="text-green-700">Get ₹60 off when you pay using UPI or Card!</p>
              <p className="text-xs text-green-600 mt-1">Available at checkout for all products</p>
            </div>

            <div className="flex items-center mt-4 gap-4">
              <button
                onClick={() => toggleWishlist(productData._id)}
                className="flex items-center justify-center p-3.5 border border-[var(--line-soft)] rounded hover:bg-gray-50 transition bg-white"
                title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={isWishlisted ? "#ef4444" : "none"} stroke={isWishlisted ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
              <button
                onClick={() => {
                  if (variantOptions.length > 0 && !selectedVariant) {
                    toast.error("Please select a variant first.");
                    return;
                  }
                  addSelectedProductToCart();
                }}
                disabled={!isAvailable}
                className={`w-full py-3.5 text-gray-800/80 transition ${
                  isAvailable
                    ? "bg-gray-100 hover:bg-gray-200"
                    : "bg-gray-200 cursor-not-allowed opacity-50"
                }`}
              >
                {isAvailable ? "Add to Cart" : "Out of Stock"}
              </button>
              <button
                onClick={() => {
                  if (!user) {
                    if (!clerkLoaded) {
                      toast.error("Please wait a moment and try again.");
                      return;
                    }
                    toast.error("Please log in to buy this product.");
                    openSignIn();
                    return;
                  }
                  if (!isAvailable) {
                    toast.error(selectedVariantUnavailable ? "This variant is currently unavailable." : "This product is currently unavailable.");
                    return;
                  }
                  if (variantOptions.length > 0 && !selectedVariant) {
                    toast.error("Please select a variant first.");
                    return;
                  }
                  addSelectedProductToCart();
                  router.push("/cart");
                }}
                disabled={!isAvailable}
                className={`brand-button w-full py-3.5 transition ${
                  isAvailable ? "" : "opacity-50 cursor-not-allowed"
                }`}
              >
                {isAvailable ? "Buy now" : "Unavailable"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex flex-col items-center mb-4 mt-16">
            <p className="text-3xl font-medium">Customer <span className="font-medium text-[var(--accent-strong)]">Reviews</span></p>
            <div className="w-28 h-0.5 bg-[var(--accent)] mt-2"></div>
          </div>

          <div className="w-full max-w-4xl mt-6">
            {displayedReviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {displayedReviews.map((review, index) => (
                  <div key={`${review.userId || index}`} className="border border-[var(--line-soft)] rounded-xl p-5 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">{review.name}</p>
                      <p className="text-xs text-gray-500">{review.date ? new Date(review.date).toLocaleDateString() : ""}</p>
                    </div>
                    <div className="flex items-center gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Image
                          key={idx}
                          className="h-3 w-3"
                          src={idx < review.rating ? assets.star_icon : assets.star_dull_icon}
                          alt="star"
                        />
                      ))}
                    </div>
                    <p className="text-gray-700 text-sm">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 mb-10">No reviews yet. Buy this product and make a review from your order page after delivery.</p>
            )}
          </div>

          {visibleRelatedProducts.length > 0 && (
            <>
              <div className="flex flex-col items-center mb-4 mt-16">
                <p className="text-3xl font-medium">Featured <span className="font-medium text-[var(--accent-strong)]">Products</span></p>
                <div className="w-28 h-0.5 bg-[var(--accent)] mt-2"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6 pb-14 w-full">
                {visibleRelatedProducts.map((product) => <ProductCard key={product._id} product={product} />)}
              </div>
              {totalRelatedPages > 1 && (
                <div className="mb-16 flex w-full flex-col gap-3 rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {relatedStart}-{relatedEnd} of {relatedProducts.length} related products
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRelatedPage((page) => Math.max(1, page - 1))}
                      disabled={safeRelatedPage === 1}
                      className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setRelatedPage((page) => Math.min(totalRelatedPages, page + 1))}
                      disabled={safeRelatedPage === totalRelatedPages}
                      className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <Link href="/all-products" className="text-sm text-[var(--accent-strong)] hover:underline -mt-8 mb-16">
            View all products
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Product;
