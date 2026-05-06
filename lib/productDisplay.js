const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const clampRating = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(5, Math.max(1, Number(number.toFixed(1))));
};

const safeJsonParse = (value, fallback = null) => {
  const text = cleanText(value);
  if (!text) return fallback;

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const parseHighlightEntries = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return { value_name: cleanText(item), percentage: "" };
      }

      if (item && typeof item === "object") {
        return item;
      }

      return { value_name: cleanText(item), percentage: "" };
    });
  }

  if (typeof value === "string") {
    const parsed = safeJsonParse(value, null);
    if (Array.isArray(parsed)) return parsed;

    return value
      .split(/[\n;|]+/)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .map((item) => ({ value_name: item, percentage: "" }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => {
      if (entry && typeof entry === "object") {
        return {
          percentage: cleanText(entry.percentage ?? entry.value ?? ""),
          value_name: cleanText(entry.value_name ?? entry.label ?? key)
        };
      }

      return {
        percentage: cleanText(entry ?? ""),
        value_name: cleanText(key)
      };
    });
  }

  return [];
};

const normalizeImageValue = (value) => {
  const text = cleanText(value);
  if (!text) return "";

  if (/^http:\/\/(?:assets\.myntassets\.com|rukminim\d*\.flixcart\.com)\//i.test(text)) {
    return text.replace(/^http:/i, "https:");
  }

  return text;
};

const normalizeImageToken = (value) => normalizeImageValue(value).toLowerCase();

const getVariantImages = (option = {}) => {
  const rawImages = [];

  if (Array.isArray(option?.image)) {
    rawImages.push(...option.image);
  } else if (option?.image) {
    rawImages.push(option.image);
  }

  if (Array.isArray(option?.images)) {
    rawImages.push(...option.images);
  } else if (option?.images) {
    rawImages.push(option.images);
  }

  if (option?.imageUrl) rawImages.push(option.imageUrl);
  if (option?.thumbnail) rawImages.push(option.thumbnail);

  return rawImages.map(normalizeImageValue).filter(Boolean);
};

const toImageArray = (value) => {
  if (Array.isArray(value)) return value.map(normalizeImageValue).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => normalizeImageValue(item))
      .filter(Boolean);
  }
  return [];
};

const upscaleFlipkartImage = (value) => {
  const text = cleanText(value);
  if (!/^https?:\/\/(?:rukminim\d*\.flixcart\.com)\//i.test(text)) {
    return normalizeImageValue(text);
  }

  return normalizeImageValue(
    text
      .replace(/(\/image\/)\d+\/\d+\//i, (_match, prefix) => `${prefix}832/832/`)
      .replace(/([?&])q=\d+/i, "$1q=90")
  );
};

const normalizeVariantOption = (option, product, index) => {
  if (!option) return null;

  if (typeof option !== "object") {
    const label = cleanText(option);
    if (!label) return null;

    return {
      id: `${slugify(label)}-${index}`,
      label,
      type: "variant",
      description: `Selected variant: ${label}`,
      image: getProductPrimaryImage(product),
      priceInr: null
    };
  }

  const explicitLabel = [
    option.label,
    option.name,
    option.title,
    option.variant,
    option.variantName,
    option.displayName
  ]
    .map(cleanText)
    .find(Boolean);

  const attributeLabel = [
    option.color,
    option.size,
    option.ram,
    option.rom,
    option.storage,
    option.capacity,
    option.memory
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" / ");

  const label = cleanText(explicitLabel || attributeLabel);
  if (!label) return null;

  const priceSource =
    option.priceInr ??
    option.offerPriceInr ??
    option.price ??
    option.offerPrice ??
    option.amountInr ??
    option.amount ??
    null;

  const variantImages = [];
  if (Array.isArray(option.image)) {
    variantImages.push(...option.image);
  } else if (option.image) {
    variantImages.push(option.image);
  }
  if (Array.isArray(option.images)) {
    variantImages.push(...option.images);
  } else if (option.images) {
    variantImages.push(option.images);
  }
  if (option.imageUrl) variantImages.push(option.imageUrl);
  if (option.thumbnail) variantImages.push(option.thumbnail);

  const normalizedVariantImages = variantImages.map(normalizeImageValue).filter(Boolean);
  const variantImage = normalizedVariantImages[0] || "";

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
    id: cleanText(option.id) || `${slugify(label)}-${index}`,
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
    image: normalizeImageValue(variantImage) || getProductPrimaryImage(product),
    images: normalizedVariantImages,
    priceInr: Number.isFinite(Number(priceSource)) ? Number(priceSource) : null,
    originalPriceInr: Number.isFinite(Number(option.originalPriceInr))
      ? Number(option.originalPriceInr)
      : null,
    available: option.available === undefined ? undefined : Boolean(option.available),
    outOfStock:
      option.outOfStock === undefined
        ? undefined
        : Boolean(option.outOfStock),
    stock: Number.isFinite(Number(option.stock)) ? Number(option.stock) : null
  };
};

const getVariantOptionSignature = (option) =>
  [
    cleanText(option?.id),
    cleanText(option?.label),
    cleanText(option?.type),
    cleanText(option?.description),
    cleanText(option?.image),
    cleanText(Array.isArray(option?.images) ? option.images.join(",") : option?.images),
    Number.isFinite(Number(option?.priceInr)) ? Number(option.priceInr) : "",
    Number.isFinite(Number(option?.originalPriceInr)) ? Number(option.originalPriceInr) : "",
    Number.isFinite(Number(option?.stock)) ? Number(option.stock) : "",
    option?.available === undefined ? "" : String(Boolean(option.available)),
    option?.outOfStock === undefined ? "" : String(Boolean(option.outOfStock))
  ]
    .join("|")
    .toLowerCase();

const dedupeVariantOptions = (options = []) => {
  const seen = new Set();
  return options.filter((option) => {
    const signature = getVariantOptionSignature(option);
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

export const normalizeProductImageUrl = (value) => upscaleFlipkartImage(value);

export const normalizeProductImages = (value) => toImageArray(value);

export const getProductPrimaryImage = (product, fallback = "") =>
  normalizeProductImages(product?.image)?.[0] ||
  normalizeImageValue(product?.productImage) ||
  fallback;

export const getProductAverageRating = (product) => {
  const reviews = Array.isArray(product?.reviews) ? product.reviews : [];
  const reviewRatings = reviews
    .map((review) => Number(review?.rating))
    .filter((rating) => Number.isFinite(rating));

  if (reviewRatings.length > 0) {
    const average = reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length;
    return Number(average.toFixed(1));
  }

  return clampRating(product?.datasetMeta?.rating ?? product?.rating);
};

export const getProductReviewCount = (product) => {
  const reviews = Array.isArray(product?.reviews) ? product.reviews : [];
  if (reviews.length > 0) return reviews.length;

  const count = Number(product?.datasetMeta?.ratingsCount ?? product?.ratingsCount);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

export const getDatasetReviewHighlights = (product) => {
  const rawHighlights =
    product?.datasetMeta?.reviewHighlights ??
    product?.datasetMeta?.featureHighlights ??
    product?.reviewHighlights ??
    product?.datasetMeta?.whatCustomersSaid ??
    product?.whatCustomersSaid;
  const highlights = parseHighlightEntries(rawHighlights);
  if (!Array.isArray(highlights)) return [];

  return highlights
    .map((item) => {
      const percentage = cleanText(item?.percentage);
      const label = cleanText(item?.value_name);

      if (!percentage && !label) return "";
      if (percentage && label) return `${percentage}% of shoppers say ${label.toLowerCase()}`;
      return label || percentage;
    })
    .filter(Boolean);
};

const getSizeVariantOptions = (product) => {
  const sizeEntries = Array.isArray(product?.datasetMeta?.sizes)
    ? product.datasetMeta.sizes
    : Array.isArray(product?.sizes)
      ? product.sizes
      : [];
  const seen = new Set();

  return sizeEntries
    .map((entry) => cleanText(entry?.size ?? entry))
    .filter(Boolean)
    .filter((size) => {
      const key = size.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((size, index) => ({
      id: `size-${index}-${slugify(size)}`,
      label: size,
      type: "size",
      description: `Selected size: ${size}`,
      image: getProductPrimaryImage(product),
      priceInr: null
    }));
};

const getColorVariantOptions = (product) => {
  const colors = Array.isArray(product?.colors) ? product.colors : [];
  const seen = new Set();

  return colors
    .map((color) => cleanText(color))
    .filter(Boolean)
    .filter((color) => {
      const key = color.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((color, index) => ({
      id: `color-${index}-${slugify(color)}`,
      label: color,
      type: "color",
      description: `Color: ${color}`,
      image: getProductPrimaryImage(product),
      priceInr: null
    }));
};

export const buildProductVariantOptions = (product) => {
  const explicitOptions = [
    ...(Array.isArray(product?.datasetMeta?.variantOptions) ? product.datasetMeta.variantOptions : []),
    ...(Array.isArray(product?.variantOptions) ? product.variantOptions : []),
    ...(Array.isArray(product?.datasetMeta?.variations) ? product.datasetMeta.variations : []),
    ...(Array.isArray(product?.variations) ? product.variations : [])
  ];

  const normalizedExplicit = explicitOptions
    .map((option, index) => normalizeVariantOption(option, product, index))
    .filter(Boolean);

  if (normalizedExplicit.length > 0) return dedupeVariantOptions(normalizedExplicit);

  const colorOptions = getColorVariantOptions(product);
  if (colorOptions.length > 0) return dedupeVariantOptions(colorOptions);

  return dedupeVariantOptions(getSizeVariantOptions(product));
};

const normalizeVariantToken = (value) => cleanText(value).toLowerCase();

export const getProductVariantGalleryEntries = (product) => {
  const productImages = normalizeProductImages(product?.image)
    .map(normalizeImageValue)
    .filter(Boolean);
  if (!productImages.length) return [];

  const seenImages = new Set();
  const uniqueImages = productImages.filter((image) => {
    const token = normalizeImageToken(image);
    if (!token || seenImages.has(token)) return false;
    seenImages.add(token);
    return true;
  });

  const variantOptions = buildProductVariantOptions(product);
  if (variantOptions.length <= 1) {
    return uniqueImages.map((image) => ({
      image,
      variantId: "",
      variantLabel: "",
      variantType: ""
    }));
  }

  const imageToVariant = new Map();
  variantOptions.forEach((option) => {
    getVariantImages(option).forEach((image) => {
      const token = normalizeImageToken(image);
      if (token && !imageToVariant.has(token)) {
        imageToVariant.set(token, option);
      }
    });
  });

  const explicitMatches = uniqueImages
    .map((image) => {
      const matchedOption = imageToVariant.get(normalizeImageToken(image));
      if (!matchedOption) return null;

      return {
        image,
        variantId: matchedOption.id,
        variantLabel: matchedOption.label,
        variantType: matchedOption.type
      };
    })
    .filter(Boolean);

  if (explicitMatches.length > 0) {
    return explicitMatches;
  }

  return uniqueImages.slice(0, variantOptions.length).map((image, index) => {
    const option = variantOptions[index] || {};
    return {
      image,
      variantId: option.id || "",
      variantLabel: option.label || "",
      variantType: option.type || ""
    };
  });
};

const matchesVariantNumber = (candidate, expected) => {
  if (!Number.isFinite(expected) || expected <= 0) return true;

  const candidateNumber = Number(candidate);
  return Number.isFinite(candidateNumber) && candidateNumber > 0 && candidateNumber === expected;
};

export const resolveProductVariantOption = (product, cartItem = {}) => {
  const variantOptions = buildProductVariantOptions(product);
  if (!variantOptions.length) return null;

  const variantId = normalizeVariantToken(cartItem?.variantId ?? cartItem?.id ?? "");
  if (variantId) {
    const byId = variantOptions.find((option) => normalizeVariantToken(option.id) === variantId);
    if (byId) return byId;
  }

  const variantImage = normalizeImageToken(
    cartItem?.variantImage ??
    cartItem?.productImage ??
    cartItem?.image ??
    cartItem?.imageUrl ??
    cartItem?.thumbnail ??
    ""
  );
  if (variantImage) {
    const byImage = variantOptions.find((option) =>
      getVariantImages(option).some((image) => normalizeImageToken(image) === variantImage)
    );
    if (byImage) return byImage;
  }

  const variantLabel = normalizeVariantToken(cartItem?.variantLabel ?? cartItem?.color ?? "");
  const variantType = normalizeVariantToken(cartItem?.variantType ?? "");
  const variantPriceInr = Number(cartItem?.variantPriceInr ?? cartItem?.priceInr ?? cartItem?.offerPriceInr);
  const variantOriginalPriceInr = Number(cartItem?.variantOriginalPriceInr ?? cartItem?.originalPriceInr);

  const exactMatch = variantOptions.find((option) => {
    if (variantLabel && normalizeVariantToken(option.label) !== variantLabel) return false;
    if (variantType && normalizeVariantToken(option.type) !== variantType) return false;
    if (!matchesVariantNumber(option.priceInr, variantPriceInr)) return false;
    if (!matchesVariantNumber(option.originalPriceInr, variantOriginalPriceInr)) return false;
    return true;
  });

  if (exactMatch) return exactMatch;

  if (variantLabel) {
    const labelMatch = variantOptions.find((option) => normalizeVariantToken(option.label) === variantLabel);
    if (labelMatch) return labelMatch;
  }

  return null;
};

export const getVariantDisplayPriceInr = (product, variant) => {
  const explicitPrice = Number(variant?.priceInr);
  if (Number.isFinite(explicitPrice) && explicitPrice > 0) {
    return explicitPrice;
  }

  return null;
};

export const getVariantDisplayDescription = (product, variant) => {
  const variantDescription = cleanText(variant?.description);
  if (variantDescription) return variantDescription;
  return cleanText(product?.description);
};

export const getVariantDisplayImage = (product, variant) => {
  const explicitImage = normalizeImageValue(
    variant?.variantImage ??
    variant?.image ??
    variant?.productImage ??
    variant?.imageUrl ??
    variant?.thumbnail ??
    ""
  );
  return explicitImage || getProductPrimaryImage(product);
};

export const getProductVariantImage = (product, cartItem = {}) => {
  const explicitImage = normalizeImageValue(
    cartItem?.variantImage ??
    cartItem?.productImage ??
    cartItem?.image ??
    cartItem?.imageUrl ??
    cartItem?.thumbnail ??
    ""
  );

  if (explicitImage) return explicitImage;

  return resolveProductVariantOption(product, cartItem)?.image || "";
};

export const buildDatasetReviewCards = (product) => {
  const rating = clampRating(product?.datasetMeta?.rating ?? product?.rating);
  const reviewCount = Number(product?.datasetMeta?.ratingsCount ?? product?.ratingsCount) || 0;
  const highlights = getDatasetReviewHighlights(product);
  const sourceId = cleanText(product?.sourceId || product?._id || "dataset");
  const reviews = [];

  if (rating) {
    reviews.push({
      userId: `dataset-${sourceId}-rating`,
      name: "Dataset summary",
      rating: Math.round(rating),
      comment: reviewCount
        ? `Average rating ${rating}/5 from ${reviewCount} shoppers.`
        : `Average rating ${rating}/5 from the dataset.`,
      date: Date.now()
    });
  }

  if (highlights.length > 0) {
    reviews.push({
      userId: `dataset-${sourceId}-highlight`,
      name: "Customer highlight",
      rating: Math.max(1, Math.min(5, Math.round(rating || 4))),
      comment: highlights.slice(0, 3).join(". "),
      date: Date.now() - 86400000
    });
  }

  const variantSource = Array.isArray(product?.datasetMeta?.variantOptions)
    ? product.datasetMeta.variantOptions
    : Array.isArray(product?.variantOptions)
      ? product.variantOptions
      : [];

  if (variantSource.length > 0) {
    const labels = variantSource
      .map((option) => cleanText(option?.label ?? option?.name ?? option?.size ?? option?.color))
      .filter(Boolean)
      .slice(0, 4);

    if (labels.length > 1) {
      reviews.push({
        userId: `dataset-${sourceId}-options`,
        name: "Catalog note",
        rating: Math.max(1, Math.min(5, Math.round(rating || 4))),
        comment: `Available options: ${labels.join(", ")}${labels.length === 4 ? "..." : ""}.`,
        date: Date.now() - 2 * 86400000
      });
    }
  }

  return reviews;
};
