import { createHash } from "node:crypto";
import { normalizeProductImages } from "./productDisplay.js";
import { compactCatalogProducts } from "./catalogCompaction.js";

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toTitleCase = (value) =>
  cleanText(value)
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const escapeRegExp = (value) => cleanText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseMoney = (value) => {
  const normalized = cleanText(value).replace(/[^0-9.]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolvePricing = (priceInr, offerPriceInr) => {
  const price = Number(priceInr);
  const offer = Number(offerPriceInr);

  if (Number.isFinite(price) && price > 0 && Number.isFinite(offer) && offer > 0) {
    return {
      priceInr: Math.max(price, offer),
      offerPriceInr: Math.min(price, offer)
    };
  }

  if (Number.isFinite(price) && price > 0) {
    return {
      priceInr: price,
      offerPriceInr: price
    };
  }

  if (Number.isFinite(offer) && offer > 0) {
    return {
      priceInr: offer,
      offerPriceInr: offer
    };
  }

  return null;
};

const parseRating = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : null;
};

const flattenProductDetails = (value) => {
  if (!Array.isArray(value)) return {};

  const details = {};

  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;

    const [rawKey, rawValue] = Object.entries(entry)[0] || [];
    const key = cleanText(rawKey);
    if (!key) return;

    const cleanedValue = Array.isArray(rawValue)
      ? rawValue.map((item) => cleanText(item)).filter(Boolean).join(", ")
      : cleanText(rawValue);

    if (!cleanedValue) return;

    if (!details[key]) {
      details[key] = cleanedValue;
      return;
    }

    const existing = new Set(
      cleanText(details[key])
        .split(/[,/|]+/)
        .map((item) => cleanText(item))
        .filter(Boolean)
    );

    cleanText(cleanedValue)
      .split(/[,/|]+/)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .forEach((item) => existing.add(item));

    details[key] = Array.from(existing).join(", ");
  });

  return details;
};

const getDetailValue = (details, keys = []) => {
  for (const key of keys) {
    const value = cleanText(details?.[key]);
    if (value) return value;
  }
  return "";
};

const splitMultiValue = (value) =>
  cleanText(value)
    .split(/[,/|]+/)
    .map((item) => cleanText(item))
    .filter(Boolean);

const getVariantAttributes = (details) => {
  const color = splitMultiValue(
    getDetailValue(details, ["Color", "Brand Color", "Secondary Color"]).replace(/\s*\(.*\)\s*$/, "")
  ).join(", ");

  const size = getDetailValue(details, ["Size"]);
  const pack = getDetailValue(details, ["Pack of", "Pack Of"]);
  const ram = getDetailValue(details, ["RAM"]);
  const rom = getDetailValue(details, ["ROM"]);
  const storage = getDetailValue(details, ["Storage"]);
  const capacity = getDetailValue(details, ["Capacity"]);
  const memory = getDetailValue(details, ["Memory"]);
  const modelName = getDetailValue(details, ["Model Name"]);
  const genericName = getDetailValue(details, ["Generic Name"]);
  const pattern = getDetailValue(details, ["Pattern"]);
  const type = getDetailValue(details, ["Type"]);
  const fit = getDetailValue(details, ["Fit", "Brand Fit"]);
  const neck = getDetailValue(details, ["Neck Type", "Neck"]);
  const sleeve = getDetailValue(details, ["Sleeve Type", "Sleeve"]);
  const closure = getDetailValue(details, ["Closure"]);
  const occasion = getDetailValue(details, ["Occasion"]);
  const fabric = getDetailValue(details, ["Fabric"]);
  const soleMaterial = getDetailValue(details, ["Sole Material"]);
  const strapMaterial = getDetailValue(details, ["Strap Material"]);

  return {
    color,
    size,
    pack,
    ram,
    rom,
    storage,
    capacity,
    memory,
    modelName,
    genericName,
    pattern,
    type,
    fit,
    neck,
    sleeve,
    closure,
    occasion,
    fabric,
    soleMaterial,
    strapMaterial
  };
};

const removeTokenFromTitle = (title, token) => {
  const cleanedToken = cleanText(token);
  if (!cleanedToken) return title;

  const escaped = escapeRegExp(cleanedToken).replace(/\s+/g, "\\s+");
  const regex = new RegExp(`\\b${escaped}\\b`, "ig");
  return title.replace(regex, " ");
};

const removePackText = (title, pack) => {
  const packValue = cleanText(pack).replace(/^(?:pack\s*of|packof)\s*/i, "");
  if (!packValue) return title;

  const regex = new RegExp(`\\bpack\\s*of\\s*${escapeRegExp(packValue).replace(/\s+/g, "\\s+")}\\b`, "ig");
  return title.replace(regex, " ");
};

const normalizeFamilyTitle = (rowTitle, attributes) => {
  let title = cleanText(rowTitle).replace(/\([^)]*\)/g, " ");

  splitMultiValue(attributes.color).forEach((color) => {
    title = removeTokenFromTitle(title, color);
  });

  title = removePackText(title, attributes.pack);

  title = title.replace(/[,:;]+/g, " ");
  title = title.replace(/\s+/g, " ").trim();
  return title;
};

const buildStyleSignature = (attributes) =>
  [
    attributes.pattern,
    attributes.type,
    attributes.fit,
    attributes.neck,
    attributes.sleeve,
    attributes.closure,
    attributes.occasion,
    attributes.fabric,
    attributes.soleMaterial,
    attributes.strapMaterial
  ]
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean)
    .join("|");

const buildVariantSignature = (attributes) =>
  [
    attributes.color,
    attributes.size,
    attributes.pack,
    attributes.ram,
    attributes.rom,
    attributes.storage,
    attributes.capacity,
    attributes.memory
  ]
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean)
    .join("|");

const buildVariantLabel = (attributes) => {
  const parts = [];

  if (attributes.color) parts.push(attributes.color);
  if (attributes.size) parts.push(attributes.size);

  const storage = [attributes.ram, attributes.rom, attributes.storage, attributes.capacity, attributes.memory]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(" / ");

  if (storage) parts.push(storage);

  if (attributes.pack) {
    const packValue = cleanText(attributes.pack).replace(/^(?:pack\s*of|packof)\s*/i, "");
    if (packValue) parts.push(`Pack of ${packValue}`);
  }

  return parts.join(" / ");
};

const buildVariantType = (attributes) => {
  if (attributes.ram || attributes.rom || attributes.storage || attributes.capacity || attributes.memory) {
    return "storage";
  }

  if (attributes.color && !attributes.size && !attributes.pack) {
    return "color";
  }

  if (attributes.size && !attributes.color && !attributes.pack) {
    return "size";
  }

  return "variant";
};

const buildVariantDescription = (attributes, details) => {
  const parts = [];

  if (attributes.color) parts.push(`Color: ${attributes.color}`);
  if (attributes.size) parts.push(`Size: ${attributes.size}`);

  const storage = [attributes.ram, attributes.rom, attributes.storage, attributes.capacity, attributes.memory]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(" / ");
  if (storage) parts.push(`Storage: ${storage}`);

  if (attributes.pack) {
    const packValue = cleanText(attributes.pack).replace(/^(?:pack\s*of|packof)\s*/i, "");
    if (packValue) parts.push(`Pack of ${packValue}`);
  }

  ["Fabric", "Pattern", "Closure", "Fit", "Neck Type", "Sleeve Type", "Sole Material", "Strap Material"].forEach((key) => {
    const value = cleanText(details?.[key]);
    if (value) parts.push(`${key}: ${value}`);
  });

  return parts.slice(0, 5).join(". ");
};

const buildProductSpecifications = (details) => {
  const preferredKeys = [
    "Fabric",
    "Pattern",
    "Closure",
    "Pockets",
    "Fit",
    "Type",
    "Neck Type",
    "Neck",
    "Sleeve",
    "Sleeve Type",
    "Sole Material",
    "Strap Material",
    "Occasion",
    "Brand Color",
    "Secondary Color",
    "Color",
    "Size",
    "Model Name",
    "Generic Name",
    "Pack of",
    "Pack Of",
    "Style Code"
  ];

  const entries = [];
  const seen = new Set();

  preferredKeys.forEach((key) => {
    const value = cleanText(details?.[key]);
    if (!value || seen.has(`${key}:${value}`)) return;
    seen.add(`${key}:${value}`);
    entries.push({ label: key, value });
  });

  Object.entries(details || {}).forEach(([key, value]) => {
    const label = cleanText(key);
    const text = cleanText(value);
    if (!label || !text || seen.has(`${label}:${text}`)) return;
    if (entries.length >= 14) return;
    seen.add(`${label}:${text}`);
    entries.push({ label, value: text });
  });

  return entries;
};

const buildFeatureHighlights = (variantRows, representative, variantCount) => {
  const highlights = [];
  const colors = Array.from(
    new Set(
      variantRows
        .map((row) => cleanText(row.attributes?.color))
        .filter(Boolean)
    )
  );

  if (variantCount > 1) {
    highlights.push(`Available in ${variantCount} variants`);
  }

  if (colors.length > 1) {
    highlights.push(`Color options: ${colors.slice(0, 4).join(", ")}`);
  } else if (colors.length === 1) {
    highlights.push(`Color: ${colors[0]}`);
  }

  ["Fabric", "Pattern", "Closure", "Fit", "Sole Material", "Strap Material", "Neck Type", "Sleeve Type"].forEach((key) => {
    const value = cleanText(representative.details?.[key]);
    if (value && highlights.length < 4) {
      highlights.push(`${toTitleCase(key)}: ${value}`);
    }
  });

  return Array.from(new Set(highlights)).slice(0, 5);
};

const getRowScore = (row) => {
  let score = 0;

  if (!row.outOfStock) score += 100;
  score += row.images.length > 0 ? 20 : 0;
  score += Math.min(row.images.length, 4) * 3;
  score += row.rating ? Math.round(row.rating * 4) : 0;
  score += row.offerPriceInr > 0 ? Math.max(0, 50 - Math.round(row.offerPriceInr / 100)) : 0;
  score += row.actualPriceInr > row.offerPriceInr && row.offerPriceInr > 0 ? 10 : 0;

  return score;
};

const mergeVariantRows = (rows) => {
  const merged = [];
  const bySignature = new Map();

  rows.forEach((row) => {
    const existing = bySignature.get(row.variantSignature);
    if (!existing) {
      const record = {
        ...row,
        images: Array.from(new Set(row.images.filter(Boolean))),
        score: getRowScore(row)
      };
      bySignature.set(row.variantSignature, record);
      merged.push(record);
      return;
    }

    existing.images = Array.from(new Set([...existing.images, ...row.images].filter(Boolean)));
    existing.outOfStock = existing.outOfStock && row.outOfStock;
    existing.available = !existing.outOfStock;
    existing.rating = existing.rating && row.rating ? Math.max(existing.rating, row.rating) : existing.rating || row.rating;
    existing.offerPriceInr = existing.offerPriceInr > 0 && row.offerPriceInr > 0
      ? Math.min(existing.offerPriceInr, row.offerPriceInr)
      : existing.offerPriceInr || row.offerPriceInr;
    existing.actualPriceInr = existing.actualPriceInr > 0 && row.actualPriceInr > 0
      ? Math.max(existing.actualPriceInr, row.actualPriceInr)
      : existing.actualPriceInr || row.actualPriceInr;
    existing.score = Math.max(existing.score, getRowScore(row));
  });

  return merged;
};

const toVariantOption = (row, index, familyId) => {
  const label = buildVariantLabel(row.attributes) || `Option ${index + 1}`;
  const variantType = buildVariantType(row.attributes);
  const explicitImage = row.images[0] || "";

  return {
    id: `${familyId}-variant-${index + 1}`,
    label,
    type: variantType,
    description: buildVariantDescription(row.attributes, row.details) || `Selected variant: ${label}`,
    image: explicitImage ? [explicitImage] : [],
    priceInr: row.offerPriceInr,
    originalPriceInr: row.actualPriceInr,
    outOfStock: Boolean(row.outOfStock),
    available: !row.outOfStock,
    stock: row.outOfStock ? 0 : 12
  };
};

const buildDisplayName = (brand, familyTitle) => {
  const cleanBrand = cleanText(brand);
  const cleanTitle = cleanText(familyTitle);

  if (cleanBrand && cleanTitle && !new RegExp(`^${escapeRegExp(cleanBrand)}\\b`, "i").test(cleanTitle)) {
    return `${cleanBrand} ${cleanTitle}`;
  }

  return cleanBrand || cleanTitle || "Flipkart Product";
};

const buildFamilyKey = (row, details, attributes, familyTitle) => {
  const styleSignature = buildStyleSignature(attributes);

  return [
    cleanText(row.brand),
    cleanText(row.sub_category),
    cleanText(familyTitle),
    cleanText(attributes.modelName || attributes.genericName),
    styleSignature
  ]
    .map((part) => cleanText(part).toLowerCase())
    .filter(Boolean)
    .join("|");
};

const buildProductDescription = (displayName, highlights, variantCount) => {
  const parts = [`${displayName} from the Flipkart catalog.`];

  if (highlights.length > 0) {
    parts.push(highlights.slice(0, 3).join(". "));
  }

  if (variantCount > 1) {
    parts.push(`Available in ${variantCount} curated variants.`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const buildBestOffer = (variant) => ({
  label: "Best price",
  priceInr: variant.offerPriceInr,
  originalPriceInr: variant.actualPriceInr,
  discountPercent:
    variant.actualPriceInr > 0 && variant.offerPriceInr > 0
      ? Math.max(0, Math.min(100, Math.round((1 - variant.offerPriceInr / variant.actualPriceInr) * 100)))
      : null
});

const buildMoreOffers = (variants) =>
  variants.slice(1, 5).map((variant) => ({
    label: variant.variantLabel || variant.label,
    priceInr: variant.offerPriceInr,
    originalPriceInr: variant.actualPriceInr,
    outOfStock: Boolean(variant.outOfStock)
  }));

const buildImageList = (variants, representative) => {
  const primaryImages = variants.flatMap((variant) => variant.images.slice(0, 1));
  const fallbackImages = representative.images.slice(0, 3);

  return Array.from(new Set([...primaryImages, ...fallbackImages].filter(Boolean))).slice(0, 8);
};

const normalizeCompactTitle = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildMergeKey = (product) =>
  [
    cleanText(product.brand || product.datasetMeta?.brand || "").toLowerCase(),
    cleanText(product.category || "").toLowerCase(),
    normalizeCompactTitle(product.name)
  ]
    .filter(Boolean)
    .join("|");

const getProductMergeScore = (product) => {
  let score = 0;
  const status = cleanText(product.status);

  if (status === "active") score += 300;
  if (status === "low_stock") score += 200;
  if (status === "out_of_stock") score += 50;

  score += Number.isFinite(Number(product.rating)) ? Number(product.rating) * 40 : 0;
  score += Number.isFinite(Number(product.ratingsCount)) ? Math.min(Number(product.ratingsCount), 250) : 0;
  score += Number.isFinite(Number(product.discountPercent)) ? Number(product.discountPercent) : 0;
  score += Array.isArray(product.image) ? Math.min(product.image.length, 8) * 3 : 0;
  score += Number.isFinite(Number(product.variantCount)) ? Math.min(Number(product.variantCount), 20) : 0;

  return score;
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

const getVariantOptionSignature = (option) =>
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

const mergeVariantOptions = (options = []) => {
  const bySignature = new Map();

  options.forEach((option) => {
    if (!option || typeof option !== "object") return;

    const label = cleanText(option.label || option.name || option.title || option.variant || option.variantName || option.displayName);
    if (!label) return;

    const type = cleanText(option.type || option.kind || "variant") || "variant";
    const image = Array.isArray(option.image)
      ? option.image[0]
      : Array.isArray(option.images)
        ? option.images[0]
        : option.image || option.images || option.imageUrl || option.thumbnail || "";

    const normalized = {
      id: cleanText(option.id) || `${slugify(label)}-${bySignature.size + 1}`,
      label,
      type,
      description: cleanText(option.description) || `Selected variant: ${label}`,
      image: image ? [image] : [],
      priceInr: Number.isFinite(Number(option.priceInr)) && Number(option.priceInr) > 0 ? Number(option.priceInr) : null,
      originalPriceInr:
        Number.isFinite(Number(option.originalPriceInr)) && Number(option.originalPriceInr) > 0
          ? Number(option.originalPriceInr)
          : null,
      available: option.available === undefined ? undefined : Boolean(option.available),
      outOfStock: option.outOfStock === undefined ? undefined : Boolean(option.outOfStock),
      stock: Number.isFinite(Number(option.stock)) ? Number(option.stock) : null
    };

    const signature = getVariantOptionSignature(normalized);
    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, normalized);
      return;
    }

    existing.image = Array.from(new Set([...existing.image, ...normalized.image].filter(Boolean))).slice(0, 8);
    existing.priceInr =
      existing.priceInr && normalized.priceInr
        ? Math.min(existing.priceInr, normalized.priceInr)
        : existing.priceInr || normalized.priceInr;
    existing.originalPriceInr =
      existing.originalPriceInr && normalized.originalPriceInr
        ? Math.max(existing.originalPriceInr, normalized.originalPriceInr)
        : existing.originalPriceInr || normalized.originalPriceInr;
    existing.available = existing.available === undefined ? normalized.available : Boolean(existing.available || normalized.available);
    existing.outOfStock = existing.outOfStock === undefined ? normalized.outOfStock : Boolean(existing.outOfStock && normalized.outOfStock);
    existing.stock = existing.stock && normalized.stock ? Math.max(existing.stock, normalized.stock) : existing.stock || normalized.stock;
  });

  return Array.from(bySignature.values()).sort((a, b) => {
    const availabilityDiff = Number(Boolean(b.available)) - Number(Boolean(a.available));
    if (availabilityDiff !== 0) return availabilityDiff;

    const priceDiff = (Number(a.priceInr) || Number.MAX_SAFE_INTEGER) - (Number(b.priceInr) || Number.MAX_SAFE_INTEGER);
    if (priceDiff !== 0) return priceDiff;

    const labelDiff = cleanText(a.label).localeCompare(cleanText(b.label));
    if (labelDiff !== 0) return labelDiff;

    return cleanText(a.type).localeCompare(cleanText(b.type));
  });
};

const mergeProductGroup = (products, groupIndex) => {
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
  const mergedImages = Array.from(new Set(sorted.flatMap((product) => normalizeProductImages(product.image)).filter(Boolean))).slice(0, 8);
  const mergedColors = mergeTextList(sorted.flatMap((product) => Array.isArray(product.colors) ? product.colors : []));
  const mergedSizes = mergeTextList(
    sorted.flatMap((product) =>
      Array.isArray(product.sizes)
        ? product.sizes.map((sizeEntry) => sizeEntry?.size).filter(Boolean)
        : []
    )
  ).map((size) => ({ size }));
  const mergedReviewHighlights = mergeTextList(
    sorted.flatMap((product) => [
      ...(Array.isArray(product.reviewHighlights) ? product.reviewHighlights : []),
      ...(Array.isArray(product.whatCustomersSaid) ? product.whatCustomersSaid : [])
    ])
  );
  const mergedVariantOptions = mergeVariantOptions(
    sorted.flatMap((product) => [
      ...(Array.isArray(product.variantOptions) ? product.variantOptions : []),
      ...(Array.isArray(product.variations) ? product.variations : [])
    ])
  );
  const bestVariant = mergedVariantOptions[0] || null;
  const availableCount = mergedVariantOptions.filter((variant) => !variant.outOfStock).length;
  const mergedRatingsCount = sorted.reduce((sum, product) => sum + (Number(product.ratingsCount) || 0), 0);
  const weightedRating = sorted.reduce((sum, product) => {
    const rating = Number(product.rating);
    const ratingsCount = Number(product.ratingsCount) || 0;
    if (!Number.isFinite(rating) || ratingsCount <= 0) return sum;
    return sum + rating * ratingsCount;
  }, 0);
  const mergedRating = mergedRatingsCount > 0 ? Number((weightedRating / mergedRatingsCount).toFixed(1)) : Number(representative.rating) || null;

  return {
    ...representative,
    sourceId: `flipkart-${familyHash(buildMergeKey(representative))}`,
    image: mergedImages.length > 0 ? mergedImages : representative.image,
    colors: mergedColors,
    sizes: mergedSizes,
    reviews: [],
    reviewHighlights: mergedReviewHighlights,
    whatCustomersSaid: mergedReviewHighlights,
    variantOptions: mergedVariantOptions,
    variations: mergedVariantOptions,
    productSpecifications: representative.productSpecifications,
    productDetails: representative.productDetails,
    ratingsCount: mergedRatingsCount || representative.ratingsCount,
    rating: mergedRating,
    variantCount: mergedVariantOptions.length || representative.variantCount,
    familySize: sorted.reduce((sum, product) => sum + (Number(product.familySize) || 1), 0),
    stock: availableCount > 0 ? Math.max(availableCount * 12, 12) : 0,
    status: availableCount > 0 ? (availableCount <= 5 ? "low_stock" : "active") : "out_of_stock",
    price: Number.isFinite(Number(bestVariant?.originalPriceInr))
      ? Number(bestVariant.originalPriceInr)
      : representative.price,
    offerPrice: Number.isFinite(Number(bestVariant?.priceInr))
      ? Number(bestVariant.priceInr)
      : representative.offerPrice,
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
      : representative.bestOffer,
    moreOffers: mergedVariantOptions.slice(1, 5).map((variant) => ({
      label: variant.label,
      priceInr: variant.priceInr,
      originalPriceInr: variant.originalPriceInr,
      outOfStock: Boolean(variant.outOfStock)
    })),
    breadcrumbs: representative.breadcrumbs,
    date: Math.min(...sorted.map((product) => Number(product.date) || Date.now())),
    familySize: sorted.length,
    mergedCount: sorted.length,
    mergedSourceIds: sorted.map((product) => product.sourceId).filter(Boolean)
  };
};

const compactConvertedProducts = (products = []) => {
  const groups = new Map();

  products.forEach((product) => {
    const mergeKey = buildMergeKey(product);
    if (!mergeKey) {
      groups.set(`fallback-${groups.size}`, [product]);
      return;
    }

    const bucket = groups.get(mergeKey);
    if (!bucket) {
      groups.set(mergeKey, [product]);
      return;
    }

    bucket.push(product);
  });

  return Array.from(groups.entries()).map(([mergeKey, groupProducts], index) => {
    if (groupProducts.length === 1) {
      const product = groupProducts[0];
      return {
        ...product,
        sourceId: `flipkart-${familyHash(mergeKey || `${product.sourceId || index}`)}`,
        mergedCount: 1,
        mergedSourceIds: [product.sourceId].filter(Boolean)
      };
    }

    return mergeProductGroup(groupProducts, index);
  });
};

const familyHash = (key) =>
  createHash("sha1")
    .update(key)
    .digest("hex")
    .slice(0, 12);

export const convertFlipkartRows = (rows = [], { userId = "seed-product-user" } = {}) => {
  const families = new Map();

  rows.forEach((row, index) => {
    const details = flattenProductDetails(row.product_details);
    const attributes = getVariantAttributes(details);
    const familyTitle = normalizeFamilyTitle(row.title, attributes) || cleanText(row.title) || "Flipkart Product";
    const familyKey = buildFamilyKey(row, details, attributes, familyTitle);
    const variantSignature = buildVariantSignature(attributes) || cleanText(row.pid) || `row-${index + 1}`;

    const variantRow = {
      pid: cleanText(row.pid),
      title: cleanText(row.title),
      brand: cleanText(row.brand),
      seller: cleanText(row.seller),
      topCategory: cleanText(row.category),
      subCategory: cleanText(row.sub_category),
      familyTitle,
      familyKey,
      variantSignature,
      attributes,
      details,
      images: normalizeProductImages(row.images),
      actualPriceInr: parseMoney(row.actual_price) ?? 0,
      offerPriceInr: parseMoney(row.selling_price) ?? 0,
      rating: parseRating(row.average_rating),
      outOfStock: Boolean(row.out_of_stock),
      discountPercent: (() => {
        const discount = cleanText(row.discount).replace(/[^0-9.]/g, "");
        const parsed = Number(discount);
        return Number.isFinite(parsed) ? parsed : 0;
      })(),
      url: cleanText(row.url),
      crawledAt: cleanText(row.crawled_at)
    };

    const family = families.get(familyKey);
    if (!family) {
      families.set(familyKey, {
        familyKey,
        rows: [variantRow]
      });
      return;
    }

    family.rows.push(variantRow);
  });

  const converted = [];
  const familyEntries = Array.from(families.values());

  familyEntries.forEach((family, familyIndex) => {
    const uniqueVariants = mergeVariantRows(family.rows);
    uniqueVariants.sort((a, b) => {
      const availabilityDiff = Number(Boolean(b.available)) - Number(Boolean(a.available));
      if (availabilityDiff !== 0) return availabilityDiff;

      const priceDiff = (Number(a.offerPriceInr) || Number.MAX_SAFE_INTEGER) - (Number(b.offerPriceInr) || Number.MAX_SAFE_INTEGER);
      if (priceDiff !== 0) return priceDiff;

      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      return cleanText(a.label).localeCompare(cleanText(b.label));
    });

    const representative = uniqueVariants[0] || family.rows[0];
    const pricing = resolvePricing(representative.actualPriceInr, representative.offerPriceInr);
    if (!pricing) {
      return;
    }

    const displayName = buildDisplayName(representative.brand, representative.familyTitle);
    const familyId = `flipkart-${familyHash(family.familyKey)}`;
    const familyImages = buildImageList(uniqueVariants, representative);
    const colors = Array.from(
      new Set(
        uniqueVariants
          .flatMap((variant) => splitMultiValue(variant.attributes?.color))
          .filter(Boolean)
      )
    );
    const sizeEntries = Array.from(
      new Set(
        uniqueVariants
          .map((variant) => cleanText(variant.attributes?.size))
          .filter(Boolean)
      )
    ).map((size) => ({ size }));
    const variantCount = uniqueVariants.length;
    const availableCount = uniqueVariants.filter((variant) => !variant.outOfStock).length;
    const stock = availableCount > 0 ? Math.max(availableCount * 12, 12) : 0;
    const averageRating = uniqueVariants
      .map((variant) => Number(variant.rating))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    const rating = averageRating.length > 0
      ? Number((averageRating.reduce((sum, value) => sum + value, 0) / averageRating.length).toFixed(1))
      : null;
    const sourcePriceInr = representative.actualPriceInr || representative.offerPriceInr || 0;
    const sourceOfferPriceInr = representative.offerPriceInr || representative.actualPriceInr || 0;
    const highlights = buildFeatureHighlights(uniqueVariants, representative, variantCount);
    const variantOptions = variantCount > 1
      ? uniqueVariants.map((variant, index) => ({
          ...toVariantOption(variant, index, familyId),
          variantLabel: buildVariantLabel(variant.attributes)
        }))
      : [];
    const price = Number(pricing.priceInr.toFixed(2));
    const offerPrice = Number(pricing.offerPriceInr.toFixed(2));

    const product = {
      source: "flipkart-dataset",
      sourceId: familyId,
      userId,
      brand: cleanText(representative.brand),
      title: cleanText(representative.title),
      name: displayName,
      description: buildProductDescription(displayName, highlights, variantCount),
      price,
      offerPrice,
      image: familyImages,
      currency: "INR",
      category: toTitleCase(representative.subCategory || representative.topCategory || "General"),
      categorySlug: slugify(representative.subCategory || representative.topCategory || "general"),
      slug: slugify(displayName),
      rating,
      ratingsCount: variantCount > 0 ? Math.max(12, variantCount * 12) : 0,
      discountPercent:
        variantCount > 0 && sourcePriceInr > 0 && sourceOfferPriceInr > 0
          ? Math.max(0, Math.min(100, Math.round((1 - sourceOfferPriceInr / sourcePriceInr) * 100)))
          : representative.discountPercent,
      stock,
      status: stock === 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "active",
      colors,
      reviews: [],
      deliveryOptions: [],
      breadcrumbs: [
        representative.topCategory || "Flipkart",
        representative.subCategory || "General",
        displayName
      ],
      productDetails: representative.details,
      productSpecifications: buildProductSpecifications(representative.details),
      sellerName: cleanText(representative.seller),
      sellerInformation: representative.seller
        ? {
            name: cleanText(representative.seller),
            platform: "Flipkart",
            source: "Flipkart dataset",
            url: representative.url || ""
          }
        : null,
      sizes: sizeEntries,
      videos: [],
      variations: variantOptions,
      whatCustomersSaid: highlights,
      reviewHighlights: highlights,
      variantOptions,
      bestOffer: buildBestOffer(representative),
      moreOffers: buildMoreOffers(uniqueVariants),
      familyKey: family.familyKey,
      familyId,
      familySize: family.rows.length,
      variantCount,
      topCategory: representative.topCategory,
      sourceUrl: representative.url,
      crawledAt: representative.crawledAt || "",
      date: (() => {
        const timestamps = family.rows
          .map((variant) => new Date(variant.crawledAt).getTime())
          .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
        return timestamps.length > 0 ? Math.min(...timestamps) : Date.now() - familyIndex * 86400000;
      })()
    };

    converted.push(product);
  });

  return compactCatalogProducts(converted);
};
