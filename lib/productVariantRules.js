const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const SIZE_KEYWORDS = [
  "clothing",
  "apparel",
  "fashion",
  "menswear",
  "womenwear",
  "kidswear",
  "ethnicwear",
  "sportswear",
  "topwear",
  "bottomwear",
  "outerwear",
  "dress",
  "dresses",
  "shirt",
  "shirts",
  "t-shirt",
  "tshirt",
  "tee",
  "top",
  "kurti",
  "kurta",
  "saree",
  "skirt",
  "skirts",
  "jeans",
  "pant",
  "pants",
  "trouser",
  "trousers",
  "shorts",
  "leggings",
  "jogger",
  "joggers",
  "hoodie",
  "jacket",
  "coat",
  "blazer",
  "sweater",
  "shoe",
  "shoes",
  "sneaker",
  "sneakers",
  "sandal",
  "sandals",
  "footwear",
  "flats",
  "heels",
  "dungaree",
  "dungarees",
  "bodysuit",
  "innerwear",
  "vest",
  "vests"
];

const COLOR_KEYWORDS = [
  "earphone",
  "headphone",
  "watch",
  "camera",
  "accessories",
  "accessory",
  "bag",
  "bags",
  "wallet",
  "speaker",
  "console",
  "projector",
  "mouse",
  "controller",
  "gaming",
  "beauty",
  "makeup",
  "skincare",
  "fragrance",
  "perfume"
];

const STORAGE_KEYWORDS = [
  "storage",
  "ram",
  "memory",
  "ssd",
  "rom",
  "hdd",
  "smartphone",
  "smart phone",
  "phone",
  "mobile phone",
  "mobile",
  "laptop",
  "notebook",
  "ultrabook",
  "chromebook",
  "tablet",
  "tab",
  "computer",
  "desktop",
  "pc",
  "macbook",
  "iphone",
  "android"
];

const PLACEHOLDER_IMAGE_PATTERNS = [
  /box[_-]?icon/i,
  /upload[_-]?area/i,
  /placeholder/i,
  /no[_-]?image/i,
  /image[_-]?not[_-]?available/i
];

export const inferCategoryVariantMode = (category = "") => {
  const value = cleanText(category).toLowerCase();
  if (!value) return "variant";

  if (COLOR_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return "color";
  }

  if (STORAGE_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return "storage";
  }

  if (SIZE_KEYWORDS.some((keyword) => value.includes(keyword))) {
    return "size";
  }

  return "variant";
};

export const resolveProductVariantMode = (product = {}) => {
  const explicitMode = cleanText(product?.variantMode).toLowerCase();
  if (["size", "color", "storage", "variant"].includes(explicitMode)) {
    return explicitMode;
  }

  if (cleanText(product?.source).toLowerCase().includes("dataset")) {
    return "";
  }

  return inferCategoryVariantMode(product?.category);
};

export const getCategoryVariantConfig = (category = "") => {
  const mode = inferCategoryVariantMode(category);

  switch (mode) {
    case "size":
      return {
        mode,
        label: "Available Sizes",
        placeholder: "S, M, L, XL",
        helperText: "Enter sizes separated by commas or new lines. Add matching offer prices and original prices in the seller form using the same order.",
      };
    case "color":
      return {
        mode,
        label: "Available Colors",
        placeholder: "Red, Blue, Black",
        helperText: "Enter color choices separated by commas or new lines. Add matching offer prices and original prices in the seller form using the same order.",
      };
    case "storage":
      return {
        mode,
        label: "RAM / ROM Options",
        placeholder: "8GB/128GB, 12GB/256GB, 16GB/512GB",
        helperText: "Enter storage configurations separated by commas or new lines. Add colors in the color field above, then enter one offer price and one original price per storage option. SageCart will repeat those prices across every color.",
      };
    default:
      return {
        mode,
        label: "Variant Options",
        placeholder: "Standard, Pro, Premium",
        helperText: "Enter the buy options for this product separated by commas or new lines. Add matching offer prices and original prices in the seller form using the same order.",
      };
  }
};

export const parseDelimitedValues = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => cleanText(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,;|]+/)
      .map((item) => cleanText(item))
      .filter(Boolean);
  }

  return [];
};

export const parseDelimitedPrices = (value) => {
  return parseDelimitedValues(value)
    .map((entry) => {
      const cleaned = String(entry).replace(/[^0-9.]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })
    .filter((price) => Number.isFinite(price));
};

export const normalizeVariantPricingPair = (offerPriceInr, originalPriceInr) => {
  const offer = Number(offerPriceInr);
  const original = Number(originalPriceInr);
  const hasOffer = Number.isFinite(offer) && offer > 0;
  const hasOriginal = Number.isFinite(original) && original > 0;

  if (hasOffer && hasOriginal) {
    if (original < offer) {
      return {
        priceInr: original,
        originalPriceInr: offer
      };
    }

    return {
      priceInr: offer,
      originalPriceInr: original
    };
  }

  return {
    priceInr: hasOffer ? offer : null,
    originalPriceInr: hasOriginal ? original : null
  };
};

const normalizeImageToken = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/[\?#].*$/g, "");

const isPlaceholderImage = (value) => {
  const token = normalizeImageToken(value);
  if (!token) return true;

  return PLACEHOLDER_IMAGE_PATTERNS.some((pattern) => pattern.test(token));
};

export const hasRenderableCatalogImage = (product = {}) => {
  const images = Array.isArray(product?.image) ? product.image : [];
  return images.some((image) => !isPlaceholderImage(image));
};

export const getRenderableCatalogImageCount = (product = {}) => {
  const images = Array.isArray(product?.image) ? product.image : [];
  return images.filter((image) => !isPlaceholderImage(image)).length;
};

const getExplicitVariantCount = (product = {}) =>
  Array.isArray(product?.variantOptions)
    ? product.variantOptions.filter(Boolean).length
    : 0;

const getSizeCount = (product = {}) =>
  Array.isArray(product?.sizes)
    ? product.sizes
        .map((entry) => cleanText(entry?.size ?? entry))
        .filter(Boolean).length
    : 0;

const getColorCount = (product = {}) =>
  Array.isArray(product?.colors)
    ? product.colors.map((entry) => cleanText(entry)).filter(Boolean).length
    : 0;

const getVariantOptionCountByType = (product = {}, types = []) => {
  const options = Array.isArray(product?.variantOptions) ? product.variantOptions : [];
  if (!options.length) return 0;

  const normalizedTypes = new Set(
    (Array.isArray(types) ? types : [types])
      .map((type) => cleanText(type).toLowerCase())
      .filter(Boolean)
  );

  return options.filter((option) => {
    const optionType = cleanText(option?.type ?? option?.kind ?? "").toLowerCase();
    if (normalizedTypes.has(optionType)) return true;

    if (normalizedTypes.has("size") && cleanText(option?.size)) return true;
    if (normalizedTypes.has("color") && cleanText(option?.color)) return true;
    if (
      normalizedTypes.has("storage") &&
      [option?.ram, option?.rom, option?.storage, option?.capacity, option?.memory]
        .map((entry) => cleanText(entry))
        .some(Boolean)
    ) {
      return true;
    }

    return false;
  }).length;
};

const getSizeVariantCount = (product = {}) =>
  Math.max(getSizeCount(product), getVariantOptionCountByType(product, "size"));

const getColorVariantCount = (product = {}) =>
  Math.max(getColorCount(product), getVariantOptionCountByType(product, "color"));

const getStorageVariantCount = (product = {}) =>
  Math.max(getVariantOptionCountByType(product, "storage"), 0);

export const hasVariantMismatch = (product = {}) => {
  const explicitVariantMode = cleanText(product?.variantMode).toLowerCase();
  const explicitVariantCount = getExplicitVariantCount(product);
  const colorCount = getColorVariantCount(product);
  const sizeCount = getSizeVariantCount(product);
  const storageCount = getStorageVariantCount(product);
  const imageCount = getRenderableCatalogImageCount(product);

  if (imageCount <= 0) return true;

  if (!explicitVariantMode || explicitVariantMode === "variant") {
    return false;
  }

  if (explicitVariantMode === "size") {
    return imageCount > 1 && sizeCount <= 1;
  }

  if (explicitVariantMode === "storage") {
    return imageCount > 1 && storageCount <= 1;
  }

  if (explicitVariantMode === "color") {
    return imageCount > 1 && colorCount <= 1;
  }

  return false;
};

export const isCatalogProductVisible = (product = {}) =>
  hasRenderableCatalogImage(product) && !hasVariantMismatch(product);

export const buildVariantOptionsFromValues = ({
  category = "",
  values = "",
  images = [],
  fallbackImage = "",
  prices = [],
  originalPrices = []
}) => {
  const mode = inferCategoryVariantMode(category);
  const labels = parseDelimitedValues(values);

  return labels.map((label, index) => {
    const matchedImage = cleanText(images[index] ?? images[0] ?? fallbackImage);
    const { priceInr, originalPriceInr } = normalizeVariantPricingPair(prices[index], originalPrices[index]);
    const description =
      mode === "size"
        ? `Selected size: ${label}`
        : mode === "color"
          ? `Color: ${label}`
          : mode === "storage"
            ? `Configuration: ${label}`
            : `Selected variant: ${label}`;

    return {
      id: `${slugify(`${mode}-${label}-${index + 1}`)}`,
      label,
      type: mode,
      description,
      image: matchedImage ? [matchedImage] : [],
      images: matchedImage ? [matchedImage] : [],
      priceInr,
      offerPriceInr: priceInr,
      originalPriceInr,
      available: true,
    };
  });
};
