import { convertUSDToINR } from "@/lib/currencyUtils";

const CART_KEY_SEPARATOR = "::";

const toPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const safeDecode = (value) => {
  const text = String(value ?? "");
  if (!text) return "";

  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

export const buildCartKey = (productId, variantLabel = "", variantMeta = {}) => {
  const label = String(variantLabel ?? "").trim();
  const variantId = String(variantMeta?.variantId ?? variantMeta?.id ?? "").trim();
  const variantImage = String(
    variantMeta?.variantImage ??
    variantMeta?.productImage ??
    variantMeta?.image ??
    ""
  ).trim();
  const priceInr = toPositiveNumber(
    variantMeta?.priceInr ??
    variantMeta?.variantPriceInr ??
    variantMeta?.offerPriceInr
  );
  const originalPriceInr = toPositiveNumber(
    variantMeta?.originalPriceInr ??
    variantMeta?.variantOriginalPriceInr
  );
  const variantType = String(variantMeta?.type ?? variantMeta?.variantType ?? "").trim();

  if (!label && !priceInr && !originalPriceInr && !variantType && !variantId && !variantImage) {
    return String(productId ?? "");
  }

  return [
    String(productId ?? ""),
    encodeURIComponent(label),
    priceInr ?? "",
    originalPriceInr ?? "",
    encodeURIComponent(variantType),
    encodeURIComponent(variantId),
    encodeURIComponent(variantImage)
  ].join(CART_KEY_SEPARATOR);
};

export const parseCartKey = (cartKey) => {
  const rawKey = String(cartKey ?? "");
  if (!rawKey) {
    return {
      productId: "",
      variantLabel: "",
      variantPriceInr: null,
      variantOriginalPriceInr: null,
      variantType: ""
    };
  }

  if (rawKey.includes(CART_KEY_SEPARATOR)) {
    const [productId = "", encodedLabel = "", price = "", originalPrice = "", encodedType = "", encodedVariantId = "", encodedVariantImage = ""] = rawKey.split(CART_KEY_SEPARATOR);
    return {
      productId,
      variantLabel: safeDecode(encodedLabel),
      variantPriceInr: toPositiveNumber(price),
      variantOriginalPriceInr: toPositiveNumber(originalPrice),
      variantType: safeDecode(encodedType),
      variantId: safeDecode(encodedVariantId),
      variantImage: safeDecode(encodedVariantImage)
    };
  }

  const [productId = "", ...variantParts] = rawKey.split("_");
  return {
    productId,
    variantLabel: variantParts.join("_"),
    variantPriceInr: null,
    variantOriginalPriceInr: null,
    variantType: "",
    variantId: "",
    variantImage: ""
  };
};

export const getCartProductQuantity = (cartItems, productId, excludeKey = "") => {
  if (!cartItems || typeof cartItems !== "object") return 0;

  return Object.entries(cartItems).reduce((total, [cartKey, quantity]) => {
    if (excludeKey && cartKey === excludeKey) return total;

    const parsed = parseCartKey(cartKey);
    if (parsed.productId !== String(productId ?? "")) return total;

    const qty = Number(quantity);
    return Number.isFinite(qty) && qty > 0 ? total + qty : total;
  }, 0);
};

export const getCartItemUnitPriceInr = (product, cartItem = {}) => {
  const variantPriceInr = toPositiveNumber(cartItem?.variantPriceInr ?? cartItem?.priceInr ?? cartItem?.offerPriceInr);
  if (variantPriceInr) return variantPriceInr;

  const basePrice = Number(product?.offerPrice ?? 0);
  return Number.isFinite(basePrice) && basePrice > 0 ? Number(convertUSDToINR(basePrice)) : 0;
};

export const getCartItemOriginalUnitPriceInr = (product, cartItem = {}) => {
  const variantOriginalPriceInr = toPositiveNumber(cartItem?.variantOriginalPriceInr ?? cartItem?.originalPriceInr);
  if (variantOriginalPriceInr) return variantOriginalPriceInr;

  const basePrice = Number(product?.price ?? product?.offerPrice ?? 0);
  return Number.isFinite(basePrice) && basePrice > 0 ? Number(convertUSDToINR(basePrice)) : 0;
};

export const getCartItemVariantLabel = (cartKey) => parseCartKey(cartKey).variantLabel;
