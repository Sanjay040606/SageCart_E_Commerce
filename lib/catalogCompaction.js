import { normalizeProductImages } from "./productDisplay.js";

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeDisplayName = (value) => cleanText(value).replace(/\s+#\d+(?:-\d+)?$/, "");

const normalizeImageSignature = (value) => {
  const text = cleanText(value);
  if (!text) return "";

  return text
    .replace(/^https?:\/\//i, "")
    .replace(/([?#].*)$/g, "")
    .replace(/\/image\/\d+\/\d+\//i, "/image/")
    .replace(/\/+$/g, "")
    .toLowerCase();
};

const getPrimaryImageSignature = (product) => {
  const images = normalizeProductImages(product?.image);
  for (const image of images) {
    const signature = normalizeImageSignature(image);
    if (signature) return signature;
  }
  return "";
};

export const buildCatalogTextKey = (product = {}) => {
  const source = cleanText(product?.source || product?.datasetMeta?.source || "");
  const sourceId = cleanText(product?.sourceId || product?.datasetMeta?.sourceId || "");
  const brand = cleanText(product?.brand || product?.datasetMeta?.brand || "");
  const category = cleanText(product?.category || product?.datasetMeta?.category || "");
  const name = normalizeDisplayName(product?.name || product?.title || "");

  if (brand || category || name) {
    return ["text", brand, category, name].filter(Boolean).join("|").toLowerCase();
  }

  if (source && sourceId) {
    return ["src", source, sourceId].filter(Boolean).join("|").toLowerCase();
  }

  return "";
};

export const buildCatalogVisualKey = (product = {}) => {
  const imageSignature = getPrimaryImageSignature(product);
  const category = cleanText(product?.category || product?.datasetMeta?.category || "");

  if (imageSignature) {
    return ["img", imageSignature, category.toLowerCase()].filter(Boolean).join("|");
  }

  return buildCatalogTextKey(product);
};

export const buildCatalogDuplicateKey = (product = {}) => buildCatalogVisualKey(product);

const buildCatalogProductId = (product, groupIndex, duplicateKey) => {
  const sourcePrefix = cleanText(product?.source || product?.datasetMeta?.source || "catalog")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "catalog";

  return `${sourcePrefix}-${hashKey(duplicateKey || product?.sourceId || groupIndex)}`;
};

const hashKey = (value) => {
  const text = cleanText(value);
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(8, "0").slice(0, 12);
};

const mergeTextList = (items = []) =>
  Array.from(
    new Map(
      items
        .map((item) => cleanText(item))
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item])
    ).values()
  );

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getProductMergeScore = (product) => {
  let score = 0;
  const status = cleanText(product?.status);

  if (status === "active") score += 300;
  if (status === "low_stock") score += 200;
  if (status === "out_of_stock") score += 50;

  score += Number.isFinite(Number(product?.rating)) ? Number(product.rating) * 40 : 0;
  score += Number.isFinite(Number(product?.ratingsCount)) ? Math.min(Number(product.ratingsCount), 250) : 0;
  score += Number.isFinite(Number(product?.discountPercent)) ? Number(product.discountPercent) : 0;
  score += Array.isArray(product?.image) ? Math.min(product.image.length, 8) * 3 : 0;
  score += Number.isFinite(Number(product?.variantCount)) ? Math.min(Number(product.variantCount), 20) : 0;

  return score;
};

const mergeVariantOptionSignature = (option) =>
  [
    cleanText(option?.label),
    cleanText(option?.type),
    cleanText(option?.description),
    cleanText(Array.isArray(option?.image) ? option.image[0] : option?.image),
    Number.isFinite(Number(option?.priceInr)) ? Number(option.priceInr) : "",
    Number.isFinite(Number(option?.originalPriceInr)) ? Number(option.originalPriceInr) : "",
    Number.isFinite(Number(option?.stock)) ? Number(option.stock) : "",
    option?.available === undefined ? "" : String(Boolean(option.available)),
    option?.outOfStock === undefined ? "" : String(Boolean(option.outOfStock))
  ]
    .join("|")
    .toLowerCase();

const normalizeVariantOption = (option, index) => {
  if (!option || typeof option !== "object") return null;

  const label = cleanText(
    option.label ||
      option.name ||
      option.title ||
      option.variant ||
      option.variantName ||
      option.displayName ||
      option.color ||
      option.size ||
      option.ram ||
      option.rom ||
      option.storage ||
      option.capacity ||
      option.memory
  );

  if (!label) return null;

  const image = Array.isArray(option.image)
    ? option.image[0]
    : Array.isArray(option.images)
      ? option.images[0]
      : option.image || option.images || option.imageUrl || option.thumbnail || "";

  const variantType = cleanText(
    option.type ||
      option.kind ||
      (option.ram || option.rom || option.storage || option.capacity || option.memory
        ? "storage"
        : option.color
          ? "color"
          : option.size
            ? "size"
            : "variant")
  ) || "variant";

  return {
    id: cleanText(option.id) || `${slugify(label)}-${index + 1}`,
    label,
    type: variantType,
    description:
      cleanText(option.description) ||
      (variantType === "color"
        ? `Color: ${label}`
        : variantType === "size"
          ? `Selected size: ${label}`
          : variantType === "storage"
            ? `Configuration: ${label}`
            : `Selected variant: ${label}`),
    image: image ? [cleanText(image).replace(/^http:/i, "https:")] : [],
    priceInr: Number.isFinite(Number(option.priceInr)) ? Number(option.priceInr) : null,
    originalPriceInr: Number.isFinite(Number(option.originalPriceInr)) ? Number(option.originalPriceInr) : null,
    available: option.available === undefined ? undefined : Boolean(option.available),
    outOfStock: option.outOfStock === undefined ? undefined : Boolean(option.outOfStock),
    stock: Number.isFinite(Number(option.stock)) ? Number(option.stock) : null
  };
};

const mergeVariantOptions = (options = []) => {
  const bySignature = new Map();

  options.forEach((option) => {
    const normalized = normalizeVariantOption(option, bySignature.size);
    if (!normalized) return;

    const signature = mergeVariantOptionSignature(normalized);
    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, normalized);
      return;
    }

    existing.image = Array.from(new Set([...existing.image, ...normalized.image].filter(Boolean))).slice(0, 8);
    existing.priceInr =
      Number.isFinite(Number(existing.priceInr)) && Number.isFinite(Number(normalized.priceInr))
        ? Math.min(Number(existing.priceInr), Number(normalized.priceInr))
        : Number.isFinite(Number(existing.priceInr))
          ? Number(existing.priceInr)
          : normalized.priceInr;
    existing.originalPriceInr =
      Number.isFinite(Number(existing.originalPriceInr)) && Number.isFinite(Number(normalized.originalPriceInr))
        ? Math.max(Number(existing.originalPriceInr), Number(normalized.originalPriceInr))
        : Number.isFinite(Number(existing.originalPriceInr))
          ? Number(existing.originalPriceInr)
          : normalized.originalPriceInr;
    existing.available =
      existing.available === undefined ? normalized.available : Boolean(existing.available || normalized.available);
    existing.outOfStock =
      existing.outOfStock === undefined ? normalized.outOfStock : Boolean(existing.outOfStock && normalized.outOfStock);
    existing.stock =
      Number.isFinite(Number(existing.stock)) && Number.isFinite(Number(normalized.stock))
        ? Math.max(Number(existing.stock), Number(normalized.stock))
        : Number.isFinite(Number(existing.stock))
          ? Number(existing.stock)
          : normalized.stock;
  });

  return Array.from(bySignature.values()).sort((a, b) => {
    const availabilityDiff = Number(Boolean(b.available)) - Number(Boolean(a.available));
    if (availabilityDiff !== 0) return availabilityDiff;

    const priceDiff =
      (Number(a.priceInr) || Number.MAX_SAFE_INTEGER) - (Number(b.priceInr) || Number.MAX_SAFE_INTEGER);
    if (priceDiff !== 0) return priceDiff;

    const labelDiff = cleanText(a.label).localeCompare(cleanText(b.label));
    if (labelDiff !== 0) return labelDiff;

    return cleanText(a.type).localeCompare(cleanText(b.type));
  });
};

const mergeProductSpecifications = (products = []) => {
  const entries = [];
  const seen = new Set();

  products.forEach((product) => {
    const specs = Array.isArray(product?.productSpecifications) ? product.productSpecifications : [];

    specs.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;

      const label = cleanText(entry.label ?? entry.name ?? entry.title);
      const value = cleanText(entry.value ?? entry.description ?? entry.text ?? "");
      if (!label && !value) return;

      const signature = `${label.toLowerCase()}|${value.toLowerCase()}`;
      if (seen.has(signature)) return;
      seen.add(signature);
      entries.push({ label, value });
    });
  });

  return entries.slice(0, 20);
};

const mergeProductDetails = (products = []) => {
  const details = {};

  products.forEach((product) => {
    const sourceDetails = product?.productDetails;
    if (!sourceDetails || typeof sourceDetails !== "object" || Array.isArray(sourceDetails)) return;

    Object.entries(sourceDetails).forEach(([key, value]) => {
      const label = cleanText(key);
      const text = cleanText(value);
      if (!label || !text) return;

      if (!details[label]) {
        details[label] = text;
        return;
      }

      const existing = new Set(
        cleanText(details[label])
          .split(/[,/|]+/)
          .map((item) => cleanText(item))
          .filter(Boolean)
      );

      text
        .split(/[,/|]+/)
        .map((item) => cleanText(item))
        .filter(Boolean)
        .forEach((item) => existing.add(item));

      details[label] = Array.from(existing).join(", ");
    });
  });

  return details;
};

const normalizeDate = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mergeProductGroup = (products, groupIndex, duplicateKey) => {
  const sorted = [...products].sort((a, b) => {
    const scoreDiff = getProductMergeScore(b) - getProductMergeScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    const priceDiff = (Number(a.offerPrice) || Number.MAX_SAFE_INTEGER) - (Number(b.offerPrice) || Number.MAX_SAFE_INTEGER);
    if (priceDiff !== 0) return priceDiff;

    const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (ratingDiff !== 0) return ratingDiff;

    return Number(b.date || 0) - Number(a.date || 0);
  });

  const representative = sorted[0];
  const displayName = normalizeDisplayName(representative?.name || representative?.title || "Product");
  const mergedSourceIds = mergeTextList(sorted.map((product) => product?.sourceId).filter(Boolean));
  const mergedImages = Array.from(
    new Set(sorted.flatMap((product) => normalizeProductImages(product?.image)).filter(Boolean))
  ).slice(0, 8);
  const mergedColors = mergeTextList(sorted.flatMap((product) => Array.isArray(product?.colors) ? product.colors : []));
  const mergedSizes = mergeTextList(
    sorted.flatMap((product) =>
      Array.isArray(product?.sizes)
        ? product.sizes.map((sizeEntry) => cleanText(sizeEntry?.size)).filter(Boolean)
        : []
    )
  ).map((size) => ({ size }));
  const mergedVariantOptions = mergeVariantOptions(
    sorted.flatMap((product) => [
      ...(Array.isArray(product?.variantOptions) ? product.variantOptions : []),
      ...(Array.isArray(product?.variations) ? product.variations : [])
    ])
  );
  const bestVariant =
    mergedVariantOptions.find((variant) => !variant.outOfStock && Number(variant.priceInr) > 0) ||
    mergedVariantOptions[0] ||
    null;
  const availableCount = mergedVariantOptions.filter((variant) => !variant.outOfStock).length;
  const ratingsCount = sorted.reduce((sum, product) => sum + toNumber(product?.ratingsCount, 0), 0);
  const weightedRating = sorted.reduce((sum, product) => {
    const rating = Number(product?.rating);
    const reviewCount = toNumber(product?.ratingsCount, 0);
    if (!Number.isFinite(rating) || reviewCount <= 0) return sum;
    return sum + rating * reviewCount;
  }, 0);
  const mergedRating = ratingsCount > 0 ? Number((weightedRating / ratingsCount).toFixed(1)) : Number(representative?.rating) || null;
  const mergedReviewHighlights = mergeTextList(
    sorted.flatMap((product) => [
      ...(Array.isArray(product?.reviewHighlights) ? product.reviewHighlights : []),
      ...(Array.isArray(product?.whatCustomersSaid) ? product.whatCustomersSaid : [])
    ])
  );
  const mergedSpecifications = mergeProductSpecifications(sorted);
  const date = Math.min(
    ...sorted.map((product, index) => normalizeDate(product?.date, Date.now() - (groupIndex + index) * 86400000))
  );
  const price = Number.isFinite(Number(bestVariant?.originalPriceInr))
    ? Number(bestVariant.originalPriceInr)
    : Number(representative?.price) || 0;
  const offerPrice = Number.isFinite(Number(bestVariant?.priceInr))
    ? Number(bestVariant.priceInr)
    : Number(representative?.offerPrice) || 0;
  const stock = availableCount > 0 ? Math.max(availableCount * 12, 12) : 0;

  return {
    ...representative,
    source: cleanText(representative?.source || representative?.datasetMeta?.source || "catalog"),
    sourceId: buildCatalogProductId(representative, groupIndex, duplicateKey || displayName),
    brand: cleanText(representative?.brand || representative?.datasetMeta?.brand || ""),
    title: cleanText(representative?.title || normalizeDisplayName(displayName)),
    name: displayName,
    slug: slugify(displayName),
    image: mergedImages.length > 0 ? mergedImages : normalizeProductImages(representative?.image),
    colors: mergedColors,
    sizes: mergedSizes,
    variantOptions: mergedVariantOptions,
    variations: mergedVariantOptions,
    productDetails: mergeProductDetails(sorted) || representative?.productDetails || {},
    productSpecifications: mergedSpecifications.length
      ? mergedSpecifications
      : Array.isArray(representative?.productSpecifications)
        ? representative.productSpecifications
        : [],
    reviewHighlights: mergedReviewHighlights,
    whatCustomersSaid: mergedReviewHighlights,
    ratingsCount,
    rating: mergedRating,
    stock,
    status: stock === 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "active",
    price,
    offerPrice,
    bestOffer: bestVariant
      ? {
          label: "Best price",
          priceInr: bestVariant.priceInr,
          originalPriceInr: bestVariant.originalPriceInr,
          discountPercent:
            Number(bestVariant.originalPriceInr) > 0 && Number(bestVariant.priceInr) > 0
              ? Math.max(0, Math.min(100, Math.round((1 - bestVariant.priceInr / bestVariant.originalPriceInr) * 100)))
              : null
        }
      : representative?.bestOffer || {},
    moreOffers: mergedVariantOptions.slice(1, 5).map((variant) => ({
      label: variant.label,
      priceInr: variant.priceInr,
      originalPriceInr: variant.originalPriceInr,
      outOfStock: Boolean(variant.outOfStock)
    })),
    variantCount: mergedVariantOptions.length || toNumber(representative?.variantCount, 0),
    familySize: sorted.length,
    mergedCount: sorted.length,
    mergedSourceIds,
    familyKey: duplicateKey || representative?.familyKey || "",
    familyId: buildCatalogProductId(representative, groupIndex, duplicateKey || displayName),
    date
  };
};

export const compactCatalogProducts = (products = []) => {
  const textStage = new Map();

  products.forEach((product, index) => {
    const key = buildCatalogTextKey(product) || `fallback-text-${index}`;
    const bucket = textStage.get(key);
    if (!bucket) {
      textStage.set(key, [product]);
      return;
    }

    bucket.push(product);
  });

  const textCompacted = Array.from(textStage.entries()).map(([duplicateKey, groupProducts], index) =>
    mergeProductGroup(groupProducts, index, duplicateKey)
  );

  const visualStage = new Map();

  textCompacted.forEach((product, index) => {
    const key = buildCatalogVisualKey(product) || `fallback-visual-${index}`;
    const bucket = visualStage.get(key);
    if (!bucket) {
      visualStage.set(key, [product]);
      return;
    }

    bucket.push(product);
  });

  return Array.from(visualStage.entries()).map(([duplicateKey, groupProducts], index) =>
    mergeProductGroup(groupProducts, index, duplicateKey)
  );
};
