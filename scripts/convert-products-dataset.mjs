import fs from "fs";
import path from "path";
import { compactCatalogProducts } from "../lib/catalogCompaction.js";

const AMAZON_INPUT_PATH = path.resolve(process.cwd(), "public/products_dataset/amazon-products.csv");
const LAZADA_INPUT_PATH = path.resolve(process.cwd(), "public/products_dataset/lazada-products.csv");
const OUTPUT_PATH = path.resolve(process.cwd(), "public/products_dataset/marketplace_products.json");

const RAW_AMAZON_SOURCE = "amazon-dataset";
const RAW_LAZADA_SOURCE = "lazada-dataset";
const MARKETPLACE_SOURCE = "marketplace-dataset";
const IDR_TO_STORE_DIVISOR = 15000;

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeUnicode = (value) =>
  cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const beautifyScrapedText = (value) =>
  normalizeUnicode(value)
    .replace(/[-â€“â€”]+/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜/g, "'")
    .replace(/â€¦/g, "...")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2");

const slugify = (value) =>
  beautifyScrapedText(value)
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

const safeJsonParse = (value, fallback = null) => {
  const text = cleanText(value);
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return fallback;

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") continue;

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const parseMoney = (value) => {
  const text = cleanText(value);
  if (!text) return null;

  const normalized = text.replace(/[^0-9.]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRating = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(Math.min(5, parsed).toFixed(1));
};

const parseCount = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;

  const text = cleanText(value).toLowerCase();
  if (!text) return false;
  return ["true", "yes", "y", "1", "available", "in stock", "instock", "open", "aktif"].includes(text);
};

const parseList = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);

  const parsed = safeJsonParse(value, null);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];

  const text = cleanText(value);
  if (!text) return [];

  if (text.includes("[" ) || text.includes("{")) {
    const maybeParsed = safeJsonParse(text, null);
    if (Array.isArray(maybeParsed)) return maybeParsed;
    if (maybeParsed && typeof maybeParsed === "object") return [maybeParsed];
  }

  return text
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean);
};

const uniqueStrings = (values = []) =>
  Array.from(
    new Map(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value])
    ).values()
  );

const normalizeImageValue = (value) => {
  const text = cleanText(value).replace(/^"+|"+$/g, "");
  if (!text || text.toLowerCase() === "null") return "";
  return text.replace(/^http:/i, "https:");
};

const parseImages = (value) => {
  const parsed = parseList(value);
  return uniqueStrings(parsed.map(normalizeImageValue).filter(Boolean)).slice(0, 8);
};

const buildHighlightText = (value) => {
  const text = beautifyScrapedText(value);
  if (!text) return "";

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (sentences.length === 0) return text;
  return sentences.slice(0, 2).join(" ");
};

const flattenSpecEntries = (value) => {
  const entries = [];
  const parsed = parseList(value);

  parsed.forEach((entry, index) => {
    if (typeof entry === "string") {
      const text = cleanText(entry);
      if (!text) return;
      entries.push({ label: `Feature ${index + 1}`, value: beautifyScrapedText(text) });
      return;
    }

    if (entry && typeof entry === "object") {
      const label = cleanText(entry.label ?? entry.name ?? entry.key ?? entry.title ?? entry.attribute);
      const rawValue = entry.value ?? entry.description ?? entry.text ?? entry.detail ?? entry.spec ?? "";
      const textValue = Array.isArray(rawValue)
        ? rawValue.map((item) => cleanText(item)).filter(Boolean).join(", ")
        : beautifyScrapedText(rawValue);

      if (!label && !textValue) return;
      entries.push({
        label: label || `Feature ${index + 1}`,
        value: textValue || label
      });
    }
  });

  return entries;
};

const flattenDetailObject = (value) => {
  const entries = flattenSpecEntries(value);
  const details = {};

  entries.forEach((entry) => {
    const label = cleanText(entry.label);
    const text = cleanText(entry.value);
    if (!label || !text) return;

    if (!details[label]) {
      details[label] = text;
      return;
    }

    const existing = new Set(
      cleanText(details[label])
        .split(/[,/|]+/)
        .map((part) => cleanText(part))
        .filter(Boolean)
    );

    text
      .split(/[,/|]+/)
      .map((part) => cleanText(part))
      .filter(Boolean)
      .forEach((part) => existing.add(part));

    details[label] = Array.from(existing).join(", ");
  });

  return details;
};

const normalizeCategoryLabel = (value) => {
  const raw = cleanText(value);
  if (!raw) return "General";

  const overrides = [
    [/^cell phones? & accessories$/i, "Phone & Tablet Accessories"],
    [/^computers? & accessories$/i, "Computers & Accessories"],
    [/^computer accessories$/i, "Computers & Accessories"],
    [/^electronic accessories$/i, "Electronics Accessories"],
    [/^aksesoris elektronik$/i, "Electronics Accessories"],
    [/^aksesoris handphone & tablet$/i, "Phone & Tablet Accessories"],
    [/^phone & tablet accessories$/i, "Phone & Tablet Accessories"],
    [/^komputer & laptop$/i, "Computers & Laptops"],
    [/^laptop umum$/i, "Laptops"],
    [/^pencetak & monitor$/i, "Printers & Monitors"],
    [/^tinta printer$/i, "Printer Ink"],
    [/^kartrid tinta$/i, "Ink Cartridges"],
    [/^televisi & video$/i, "TV & Video"],
    [/^televisi digital$/i, "Digital TVs"],
    [/^tools & home improvement$/i, "Tools & Home Improvement"],
    [/^home improvement$/i, "Home Improvement"],
    [/^home & kitchen$/i, "Home & Kitchen"],
    [/^kitchen & dining$/i, "Kitchen & Dining"],
    [/^household supplies$/i, "Household Supplies"],
    [/^beauty & personal care$/i, "Beauty & Personal Care"],
    [/^kecantikan$/i, "Beauty & Personal Care"],
    [/^health & household$/i, "Health & Household"],
    [/^grocery & gourmet food$/i, "Grocery & Gourmet Food"],
    [/^pet supplies$/i, "Pet Supplies"],
    [/^sports & outdoors$/i, "Sports & Outdoors"],
    [/^industrial & scientific$/i, "Industrial & Scientific"],
    [/^office products$/i, "Office Products"],
    [/^patio, lawn & garden$/i, "Garden & Outdoor"],
    [/^musical instruments$/i, "Musical Instruments"],
    [/^toys & games$/i, "Toys & Games"],
    [/^baby$/i, "Baby"],
    [/^automotive$/i, "Automotive"],
    [/^camping & hiking$/i, "Camping & Hiking"],
    [/^handphone & tablet$/i, "Phone & Tablet Accessories"],
    [/^organization, storage & transport$/i, "Storage & Organization"],
    [/^perawatan pribadi & kecantikan$/i, "Beauty & Personal Care"]
  ];

  for (const [pattern, label] of overrides) {
    if (pattern.test(raw)) return label;
  }

  return toTitleCase(raw.replace(/[-_]+/g, " ").replace(/&/g, "&"));
};

const normalizeCategorySlug = (value) =>
  slugify(normalizeCategoryLabel(value))
    .replace(/and/g, "and")
    .replace(/^-+|-+$/g, "");

const categoryCandidates = (row, source) => {
  if (source === "amazon") {
    return uniqueStrings([
      row.root_bs_category,
      row.bs_category,
      row.department,
      row.subcategory,
      ...parseList(row.categories)
    ]);
  }

  return uniqueStrings([
    row.root_bs_category,
    row.bs_category,
    row.department,
    row.subcategory,
    ...parseList(row.breadcrumb)
  ]);
};

const denyTerms = [
  "clothing",
  "apparel",
  "fashion",
  "garment",
  "garments",
  "wear",
  "mens wear",
  "womens wear",
  "women's clothing",
  "men's clothing",
  "dress",
  "dresses",
  "shirt",
  "shirts",
  "t shirt",
  "t-shirt",
  "tee",
  "tees",
  "top",
  "tops",
  "blouse",
  "blouses",
  "kurta",
  "kurti",
  "saree",
  "lehenga",
  "salwar",
  "ethnic",
  "jacket",
  "jackets",
  "coat",
  "coats",
  "hoodie",
  "hoodies",
  "sweater",
  "sweaters",
  "sweatshirt",
  "cardigan",
  "pants",
  "trousers",
  "jeans",
  "shorts",
  "skirt",
  "skirts",
  "lingerie",
  "underwear",
  "innerwear",
  "bra",
  "bras",
  "panties",
  "boxer",
  "boxers",
  "sleepwear",
  "nightwear",
  "pajama",
  "pyjama",
  "swimwear",
  "shoe",
  "shoes",
  "footwear",
  "sandal",
  "sandals",
  "boot",
  "boots",
  "slipper",
  "slippers",
  "sneaker",
  "sneakers",
  "sock",
  "socks",
  "stocking",
  "stockings",
  "watch",
  "watches",
  "jewelry",
  "jewellery",
  "necklace",
  "bracelet",
  "ring",
  "earring",
  "earrings",
  "hat",
  "hats",
  "cap",
  "caps",
  "scarf",
  "scarves",
  "shawl",
  "gloves",
  "bag",
  "bags",
  "backpack",
  "backpacks",
  "handbag",
  "handbags",
  "wallet",
  "wallets",
  "belt",
  "belts",
  "purse",
  "purses",
  "clutch",
  "clutches",
  "luggage",
  "suitcase",
  "suitcases",
  "trolley bag",
  "travel bag",
  "waist bag",
  "fanny pack",
  "messenger bag",
  "shoulder bag",
  "crossbody",
  "tote bag",
  "school bag",
  "laptop bag",
  "tas",
  "pakaian",
  "baju",
  "kaos",
  "celana",
  "rok",
  "jaket",
  "sepatu",
  "sandal",
  "koper",
  "dompet",
  "sabuk",
  "hijab",
  "kerudung",
  "gamis",
  "abaya",
  "busana"
];

const keepTerms = [
  "electronics",
  "electronic",
  "elektronik",
  "computer",
  "computers",
  "komputer",
  "laptop",
  "notebook",
  "printer",
  "monitor",
  "mobile",
  "phone",
  "handphone",
  "smartphone",
  "tablet",
  "camera",
  "audio",
  "speaker",
  "headphone",
  "headphones",
  "earphone",
  "earphones",
  "headset",
  "charger",
  "cable",
  "adapter",
  "power bank",
  "case",
  "cover",
  "casing",
  "screen protector",
  "tv",
  "television",
  "home",
  "kitchen",
  "appliance",
  "household",
  "cleaning",
  "storage",
  "furniture",
  "decor",
  "lighting",
  "tools",
  "home improvement",
  "automotive",
  "car",
  "pet",
  "office",
  "stationery",
  "beauty",
  "personal care",
  "health",
  "grocery",
  "baby",
  "sports",
  "outdoors",
  "industrial",
  "scientific",
  "garden",
  "patio",
  "pool",
  "bath",
  "printer ink",
  "cartridge",
  "replacement parts",
  "maintenance",
  "upkeep",
  "repair",
  "mobile accessories",
  "phone accessories",
  "tablet accessories",
  "electronics accessories",
  "computer accessories",
  "accessories",
  "usb",
  "network",
  "router",
  "keyboard",
  "mouse",
  "gaming",
  "console",
  "components",
  "component",
  "transistor",
  "capacitor",
  "diode",
  "resistor",
  "musical instruments",
  "toys",
  "games"
];

const normalizeSearchText = (value) => normalizeUnicode(value).toLowerCase();

const hasAnyTerm = (text, terms) => terms.some((term) => text.includes(term));

const isMarketplaceRow = (row, source) => {
  const text = normalizeSearchText(
    [
      row.title,
      row.description,
      row.product_description,
      row.product_details,
      row.features,
      row.product_specifications,
      row.department,
      row.root_bs_category,
      row.bs_category,
      row.subcategory,
      ...categoryCandidates(row, source)
    ]
      .map((value) => cleanText(value))
      .filter(Boolean)
      .join(" ")
  );

  if (!text) return false;
  if (hasAnyTerm(text, denyTerms)) return false;
  if (hasAnyTerm(text, keepTerms)) return true;

  return false;
};

const extractGenericVariantTokens = (value) => {
  const text = normalizeUnicode(value);
  if (!text) return [];

  const patterns = [
    /\b\d+(?:\.\d+)?\s?(?:gb|tb|mb|kb|ghz|mhz|mah|w|wh)\b/gi,
    /\b\d+(?:\.\d+)?\s?(?:inch(?:es)?|in)\b/gi,
    /\b(?:xxxl|xxl|xl|xl|small|medium|large|extra\s*large|one\s*size)\b/gi,
    /\b(?:pack\s*of\s*\d+|\d+\s*pack|\d+\s*pcs?|\d+\s*pieces?|\d+\s*piece(?:s)?|set\s*of\s*\d+)\b/gi,
    /\b(?:black|white|blue|red|green|yellow|orange|purple|pink|silver|gold|gray|grey|brown|beige|navy|maroon|violet|clear|transparent|multi(?:\s|-)?color|multicolor|merah jambu|biru tua|biru muda|biru dongker|hitam|putih|merah|hijau|kuning|cokelat|abu(?:-?abu)?|oranye|ungu|tosca)\b/gi
  ];

  const tokens = [];
  patterns.forEach((pattern) => {
    const matches = text.match(pattern) || [];
    matches.forEach((match) => tokens.push(cleanText(match)));
  });

  return uniqueStrings(tokens);
};

const removeTokensFromText = (value, tokens = []) => {
  let text = beautifyScrapedText(value).replace(/\([^)]*\)/g, " ");

  uniqueStrings(tokens)
    .sort((a, b) => b.length - a.length)
    .forEach((token) => {
      if (!token) return;
      const pattern = new RegExp(`\\b${escapeRegExp(token).replace(/\s+/g, "\\s+")}\\b`, "ig");
      text = text.replace(pattern, " ");
    });

  return cleanText(text.replace(/[,:;]+/g, " "));
};

const buildDisplayName = (brand, title) => {
  const cleanBrand = cleanText(brand);
  const cleanTitle = cleanText(title);

  if (!cleanBrand) return cleanTitle;
  if (!cleanTitle) return cleanBrand;

  const brandText = normalizeSearchText(cleanBrand);
  const titleText = normalizeSearchText(cleanTitle);
  if (titleText.startsWith(brandText)) return cleanTitle;

  return `${cleanBrand} ${cleanTitle}`;
};

const inferVariantType = (label, context = "") => {
  const text = normalizeSearchText(`${label} ${context}`);
  if (!text) return "variant";

  if (/\b(?:ram|rom|ssd|hdd|storage|memory|capacity|gb|tb|mb|kgb|ghz|mhz|mah|w|wh)\b/.test(text)) {
    return "storage";
  }

  if (/\b(?:black|white|blue|red|green|yellow|orange|purple|pink|silver|gold|gray|grey|brown|beige|navy|maroon|violet|clear|transparent|merah jambu|biru tua|biru muda|biru dongker|hitam|putih|merah|hijau|kuning|cokelat|abu|oranye|ungu|tosca)\b/.test(text)) {
    return "color";
  }

  if (/\b(?:xxxl|xxl|xl|xl|small|medium|large|extra large|size|inch|inches)\b/.test(text)) {
    return "size";
  }

  return "variant";
};

const buildVariantOption = ({
  label,
  context,
  id,
  image,
  priceInr,
  originalPriceInr,
  stock,
  available
}) => {
  const cleanLabel = cleanText(label);
  if (!cleanLabel) return null;

  const variantType = inferVariantType(cleanLabel, context);
  return {
    id: cleanText(id) || `${slugify(cleanLabel)}-${variantType}`,
    label: cleanLabel,
    type: variantType,
    description:
      variantType === "color"
        ? `Color: ${cleanLabel}`
        : variantType === "size"
          ? `Selected size: ${cleanLabel}`
          : variantType === "storage"
            ? `Configuration: ${cleanLabel}`
            : `Selected variant: ${cleanLabel}`,
    image: image ? [normalizeImageValue(image)].filter(Boolean) : [],
    priceInr: Number.isFinite(Number(priceInr)) ? Number(priceInr) : null,
    originalPriceInr: Number.isFinite(Number(originalPriceInr)) ? Number(originalPriceInr) : null,
    stock: Number.isFinite(Number(stock)) ? Number(stock) : null,
    available: available === undefined ? undefined : Boolean(available),
    outOfStock: available === undefined ? undefined : !Boolean(available)
  };
};

const buildPricePair = (priceA, priceB, fallback = 0) => {
  const numericA = Number(priceA);
  const numericB = Number(priceB);

  const candidates = [numericA, numericB].filter((value) => Number.isFinite(value) && value > 0);
  if (candidates.length === 0) {
    const fallbackValue = Number(fallback);
    if (Number.isFinite(fallbackValue) && fallbackValue > 0) {
      return {
        price: Number(fallbackValue.toFixed(2)),
        offerPrice: Number(fallbackValue.toFixed(2))
      };
    }
    return null;
  }

  const price = Math.max(...candidates);
  const offerPrice = Math.min(...candidates);
  return {
    price: Number(price.toFixed(2)),
    offerPrice: Number(offerPrice.toFixed(2))
  };
};

const buildAmazonStock = (availability, reviewsCount) => {
  const text = normalizeSearchText(availability);
  if (!text) return Math.max(3, Math.min(30, Math.round((Number(reviewsCount) || 0) / 40) || 8));

  const leftMatch = text.match(/only\s+(\d+)\s+left/);
  if (leftMatch) return Math.max(1, Number(leftMatch[1]));
  if (text.includes("out of stock") || text.includes("currently unavailable")) return 0;
  if (text.includes("in stock")) return Math.max(3, Math.min(40, Math.round((Number(reviewsCount) || 0) / 25) || 12));

  return Math.max(3, Math.min(30, Math.round((Number(reviewsCount) || 0) / 40) || 8));
};

const buildLazadaStock = (row) => {
  if (parseBoolean(row.out_of_stock)) return 0;
  if (!parseBoolean(row.is_available) && cleanText(row.is_available)) return 0;

  const sold = parseCount(row.number_sold, 0);
  if (sold > 0) return Math.max(3, Math.min(50, Math.round(sold / 15) + 3));

  const reviews = parseCount(row.reviews, 0);
  if (reviews > 0) return Math.max(3, Math.min(30, Math.round(reviews / 10) + 3));

  return 8;
};

const buildAmazonCategory = (row) => {
  const categories = categoryCandidates(row, "amazon");
  const chosen = categories.find((value) => {
    const text = normalizeSearchText(value);
    return hasAnyTerm(text, keepTerms) && !hasAnyTerm(text, denyTerms);
  });

  return normalizeCategoryLabel(chosen || categories[0] || row.root_bs_category || row.department || "General");
};

const buildLazadaCategory = (row) => {
  const categories = categoryCandidates(row, "lazada");
  const chosen = categories.find((value) => {
    const text = normalizeSearchText(value);
    return hasAnyTerm(text, keepTerms) && !hasAnyTerm(text, denyTerms);
  });

  return normalizeCategoryLabel(chosen || categories[0] || row.root_bs_category || row.department || "General");
};

const buildFamilyAndVariantLabels = (title, tokens = [], fallback = "") => {
  const tokenList = uniqueStrings(tokens);
  const familyTitle = removeTokensFromText(title, tokenList) || removeTokensFromText(title, extractGenericVariantTokens(title)) || cleanText(title);
  const variantLabel =
    cleanText(tokenList.join(" / ")) ||
    cleanText(removeTokensFromText(title, []))
      .replace(familyTitle, "")
      .trim() ||
    cleanText(fallback) ||
    cleanText(title);

  return {
    familyTitle,
    variantLabel
  };
};

const buildAmazonRow = (row, index) => {
  const asin = cleanText(row.asin || row.input_asin || row.parent_asin || `amazon-${index + 1}`);
  const title = beautifyScrapedText(row.title || row.product_description || "Amazon Product");
  const brand = cleanText(row.brand || row.manufacturer || row.buybox_seller || row.seller_name || "No Brand");
  const categories = categoryCandidates(row, "amazon");
  const selectedVariation = parseList(row.variations).find((entry) => entry && typeof entry === "object" && cleanText(entry.asin) === asin);
  const explicitVariantLabel = cleanText(
    selectedVariation?.name ||
      selectedVariation?.label ||
      selectedVariation?.value ||
      selectedVariation?.variant ||
      row.color ||
      row.size ||
      row.model_number ||
      row.department
  );
  const genericTokens = extractGenericVariantTokens(title);
  const variantTokens = uniqueStrings([explicitVariantLabel, ...genericTokens]);
  const { familyTitle, variantLabel } = buildFamilyAndVariantLabels(title, variantTokens, asin);
  const displayName = buildDisplayName(brand, familyTitle);
  const pricePair = buildPricePair(parseMoney(row.initial_price), parseMoney(row.final_price));
  if (!pricePair) return null;

  const rating = parseRating(row.rating);
  const reviewsCount = parseCount(row.reviews_count, 0);
  const stock = buildAmazonStock(row.availability, reviewsCount);
  const category = buildAmazonCategory(row);
  const images = parseImages(row.images).length > 0 ? parseImages(row.images) : parseImages(row.image_url);
  const productDetails = flattenDetailObject(row.product_details);
  const productSpecifications = [
    ...flattenSpecEntries(row.features),
    ...flattenSpecEntries(row.delivery)
  ].slice(0, 20);
  const reviewHighlights = uniqueStrings([
    buildHighlightText(row.top_review),
    ...flattenSpecEntries(row.features).map((entry) => `${entry.label}: ${entry.value}`),
    ...flattenSpecEntries(row.product_details).slice(0, 4).map((entry) => `${entry.label}: ${entry.value}`)
  ]).slice(0, 6);
  const variantOption = buildVariantOption({
    label: variantLabel || explicitVariantLabel || familyTitle || asin,
    context: title,
    id: asin,
    image: images[0] || row.image_url,
    priceInr: pricePair.offerPrice,
    originalPriceInr: pricePair.price,
    stock,
    available: stock > 0
  });

  return {
    source: MARKETPLACE_SOURCE,
    sourceOrigin: RAW_AMAZON_SOURCE,
    sourceId: asin,
    brand,
    title,
    name: displayName,
    description:
      [
        beautifyScrapedText(row.description),
        ...reviewHighlights.slice(0, 2)
      ]
        .map((part) => cleanText(part))
        .filter(Boolean)
        .join(". ") || beautifyScrapedText(row.description) || title,
    price: pricePair.price,
    offerPrice: pricePair.offerPrice,
    image: images,
    currency: cleanText(row.currency) || "USD",
    category,
    categorySlug: normalizeCategorySlug(category),
    slug: slugify(displayName),
    rating,
    ratingsCount: reviewsCount,
    discountPercent: (() => {
      const explicitDiscount = parseCount(row.discount, 0);
      if (explicitDiscount) return Math.max(0, Math.min(100, explicitDiscount));
      if (pricePair.price > 0 && pricePair.offerPrice > 0) {
        return Math.max(0, Math.min(100, Math.round((1 - pricePair.offerPrice / pricePair.price) * 100)));
      }
      return 0;
    })(),
    stock,
    status: stock === 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "active",
    colors: variantOption?.type === "color" && variantOption?.label ? [variantOption.label] : [],
    reviews: [],
    deliveryOptions: parseList(row.delivery).map((entry) => beautifyScrapedText(entry)).filter(Boolean),
    breadcrumbs: categories,
    productDetails,
    productSpecifications,
    sellerName: cleanText(row.seller_name || row.buybox_seller || row.manufacturer || brand),
    sellerInformation: row.seller_name || row.buybox_seller
      ? {
          name: cleanText(row.seller_name || row.buybox_seller || brand),
          platform: "Amazon",
          source: "Amazon dataset",
          url: cleanText(row.url || row.origin_url || ""),
          rating: cleanText(row.seller_ratings || ""),
          shipOnTime: cleanText(row.seller_ship_on_time || ""),
          chatResponse: cleanText(row.seller_chat_response || "")
        }
      : null,
    sizes: variantOption?.type === "size" && variantOption?.label ? [{ size: variantOption.label }] : [],
    videos: parseList(row.video).filter(Boolean),
    variations: variantOption ? [variantOption] : [],
    whatCustomersSaid: reviewHighlights,
    reviewHighlights,
    variantOptions: variantOption ? [variantOption] : [],
    bestOffer: {
      label: "Best price",
      priceInr: pricePair.offerPrice,
      originalPriceInr: pricePair.price,
      discountPercent: (() => {
        if (pricePair.price > 0 && pricePair.offerPrice > 0) {
          return Math.max(0, Math.min(100, Math.round((1 - pricePair.offerPrice / pricePair.price) * 100)));
        }
        return 0;
      })()
    },
    moreOffers: [],
    sourceUrl: cleanText(row.url || row.origin_url || ""),
    parentAsin: cleanText(row.parent_asin || ""),
    inputAsin: cleanText(row.input_asin || ""),
    date: (() => {
      const timestamp = Date.parse(row.timestamp || row.date_first_available || "");
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now() - index * 86400000;
    })(),
    datasetMeta: {
      sourceOrigin: RAW_AMAZON_SOURCE,
      sourceCurrency: cleanText(row.currency) || "USD",
      asin,
      parentAsin: cleanText(row.parent_asin || ""),
      inputAsin: cleanText(row.input_asin || ""),
      sourceUrl: cleanText(row.url || row.origin_url || ""),
      reviewHighlights,
      productDetails,
      productSpecifications,
      deliveryOptions: parseList(row.delivery).map((entry) => beautifyScrapedText(entry)).filter(Boolean)
    }
  };
};

const buildLazadaRow = (row, index) => {
  const sku = cleanText(row.sku || row.mpn || row.url || `lazada-${index + 1}`);
  const title = beautifyScrapedText(row.title || row.product_description || "Lazada Product");
  const brand = cleanText(row.brand || row.seller_name || "No Brand");
  const categories = categoryCandidates(row, "lazada");
  const selectedVariants = parseList(row.product_variation);
  const colorVariants = parseList(row.colors);
  const selectedLabels = uniqueStrings([
    row.color,
    ...selectedVariants.map((entry) =>
      cleanText(entry && typeof entry === "object" ? entry.value || entry.name || entry.label : entry)
    ),
    ...colorVariants
  ]);
  const genericTokens = extractGenericVariantTokens(title);
  const variantTokens = uniqueStrings([...selectedLabels, ...genericTokens]);
  const { familyTitle, variantLabel } = buildFamilyAndVariantLabels(title, variantTokens, sku);
  const displayName = buildDisplayName(brand, familyTitle);
  const initialInr = parseMoney(row.initial_price);
  const finalInr = parseMoney(row.final_price);
  const storePricePair = buildPricePair(
    Number.isFinite(initialInr) ? initialInr / IDR_TO_STORE_DIVISOR : null,
    Number.isFinite(finalInr) ? finalInr / IDR_TO_STORE_DIVISOR : null
  );

  if (!storePricePair) return null;

  const rating = parseRating(row.rating);
  const reviewsCount = parseCount(row.reviews, 0);
  const stock = buildLazadaStock(row);
  const category = buildLazadaCategory(row);
  const images = parseImages(row.image);
  const productDetails = flattenDetailObject(row.product_specifications);
  const productSpecifications = flattenSpecEntries(row.product_specifications).slice(0, 20);
  const reviewHighlights = uniqueStrings([
    ...productSpecifications.slice(0, 4).map((entry) => `${entry.label}: ${entry.value}`),
    buildHighlightText(row.product_description)
  ]).slice(0, 6);
  const variantOption = buildVariantOption({
    label: variantLabel || selectedLabels[0] || familyTitle || sku,
    context: title,
    id: sku,
    image: images[0],
    priceInr: storePricePair.offerPrice,
    originalPriceInr: storePricePair.price,
    stock,
    available: stock > 0
  });

  return {
    source: MARKETPLACE_SOURCE,
    sourceOrigin: RAW_LAZADA_SOURCE,
    sourceId: sku,
    brand,
    title,
    name: displayName,
    description:
      [
        beautifyScrapedText(row.product_description),
        ...reviewHighlights.slice(0, 2)
      ]
        .map((part) => cleanText(part))
        .filter(Boolean)
        .join(". ") || beautifyScrapedText(row.product_description) || title,
    price: storePricePair.price,
    offerPrice: storePricePair.offerPrice,
    image: images,
    currency: cleanText(row.currency) || "IDR",
    category,
    categorySlug: normalizeCategorySlug(category),
    slug: slugify(displayName),
    rating,
    ratingsCount: reviewsCount,
    discountPercent: (() => {
      const numericDiscount = parseCount(row.discount, 0);
      if (numericDiscount) {
        return Math.max(0, Math.min(100, numericDiscount > 1 ? Math.round(numericDiscount) : 0));
      }
      if (storePricePair.price > 0 && storePricePair.offerPrice > 0) {
        return Math.max(0, Math.min(100, Math.round((1 - storePricePair.offerPrice / storePricePair.price) * 100)));
      }
      return 0;
    })(),
    stock,
    status: stock === 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "active",
    colors: variantOption?.type === "color" && variantOption?.label ? [variantOption.label] : uniqueStrings(colorVariants),
    reviews: [],
    deliveryOptions: [],
    breadcrumbs: categories,
    productDetails,
    productSpecifications,
    sellerName: cleanText(row.seller_name || brand),
    sellerInformation: row.seller_name
      ? {
          name: cleanText(row.seller_name),
          platform: "Lazada",
          source: "Lazada dataset",
          url: cleanText(row.url || ""),
          ratings: cleanText(row.seller_ratings || ""),
          shipOnTime: cleanText(row.seller_ship_on_time || ""),
          chatResponse: cleanText(row.seller_chat_response || "")
        }
      : null,
    sizes: [],
    videos: parseList(row.video),
    variations: variantOption ? [variantOption] : [],
    whatCustomersSaid: reviewHighlights,
    reviewHighlights,
    variantOptions: variantOption ? [variantOption] : [],
    bestOffer: {
      label: "Best price",
      priceInr: storePricePair.offerPrice,
      originalPriceInr: storePricePair.price,
      discountPercent: (() => {
        if (storePricePair.price > 0 && storePricePair.offerPrice > 0) {
          return Math.max(0, Math.min(100, Math.round((1 - storePricePair.offerPrice / storePricePair.price) * 100)));
        }
        return 0;
      })()
    },
    moreOffers: [],
    sourceUrl: cleanText(row.url || ""),
    date: (() => {
      const timestamp = Date.parse(row.timestamp || row.date || "");
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now() - index * 86400000;
    })(),
    datasetMeta: {
      sourceOrigin: RAW_LAZADA_SOURCE,
      sourceCurrency: cleanText(row.currency) || "IDR",
      sku,
      sourceUrl: cleanText(row.url || ""),
      reviewHighlights,
      productDetails,
      productSpecifications,
      deliveryOptions: [],
      lazadaSellerRatings: cleanText(row.seller_ratings || ""),
      lazadaShipOnTime: cleanText(row.seller_ship_on_time || ""),
      lazadaChatResponse: cleanText(row.seller_chat_response || "")
    }
  };
};

const finalizeProducts = (products = []) =>
  products.map((product) => {
    const mergedSourceIds = Array.isArray(product.mergedSourceIds) ? product.mergedSourceIds : [];
    const mergedOrigins = uniqueStrings(
      mergedSourceIds
        .map((value) => cleanText(value))
        .filter(Boolean)
        .map((value) => value.split("-")[0])
    );

    return {
      ...product,
      source: MARKETPLACE_SOURCE,
      datasetMeta: {
        ...(product.datasetMeta && typeof product.datasetMeta === "object" ? product.datasetMeta : {}),
        sourceOrigin: cleanText(product.datasetMeta?.sourceOrigin || mergedOrigins[0] || MARKETPLACE_SOURCE),
        marketplaceSources: mergedOrigins.length > 0 ? mergedOrigins : [cleanText(product.datasetMeta?.sourceOrigin || MARKETPLACE_SOURCE)]
      }
    };
  });

const loadRows = (inputPath) => {
  if (!fs.existsSync(inputPath)) {
    return [];
  }

  const csvText = fs.readFileSync(inputPath, "utf8");
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => cleanText(header));
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cleanText(cell)))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
};

const main = () => {
  if (!fs.existsSync(AMAZON_INPUT_PATH)) {
    throw new Error(`Dataset not found: ${AMAZON_INPUT_PATH}`);
  }

  if (!fs.existsSync(LAZADA_INPUT_PATH)) {
    throw new Error(`Dataset not found: ${LAZADA_INPUT_PATH}`);
  }

  const amazonRows = loadRows(AMAZON_INPUT_PATH);
  const lazadaRows = loadRows(LAZADA_INPUT_PATH);

  if (amazonRows.length === 0 && lazadaRows.length === 0) {
    throw new Error("Marketplace datasets do not contain any rows.");
  }

  const amazonProducts = amazonRows
    .filter((row) => isMarketplaceRow(row, "amazon"))
    .map((row, index) => buildAmazonRow(row, index))
    .filter(Boolean);

  const lazadaProducts = lazadaRows
    .filter((row) => isMarketplaceRow(row, "lazada"))
    .map((row, index) => buildLazadaRow(row, index))
    .filter(Boolean);

  const compacted = finalizeProducts(
    compactCatalogProducts([...amazonProducts, ...lazadaProducts]).filter((product) => {
      const name = cleanText(product.name);
      const price = Number(product.price);
      const offerPrice = Number(product.offerPrice);
      const imageCount = Array.isArray(product.image) ? product.image.length : 0;
      return Boolean(name) && Number.isFinite(price) && Number.isFinite(offerPrice) && price > 0 && offerPrice > 0 && imageCount > 0;
    })
  );

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(compacted, null, 2));

  const categoryCounts = compacted.reduce((acc, product) => {
    const category = cleanText(product.category) || "General";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([category, count]) => `${category}: ${count}`);

  console.log(`Filtered ${amazonRows.length} Amazon rows into ${amazonProducts.length} products.`);
  console.log(`Filtered ${lazadaRows.length} Lazada rows into ${lazadaProducts.length} products.`);
  console.log(`Compacted marketplace catalog down to ${compacted.length} SageCart products.`);
  console.log(`Output written to ${OUTPUT_PATH}`);
  console.log(`Top categories: ${topCategories.join(", ")}`);
  console.log("Sample products:");
  compacted.slice(0, 5).forEach((product, index) => {
    console.log(
      `${index + 1}. ${product.name} | ${product.category} | variants ${Number(product.variantCount || product.variantOptions?.length || 0)} | ${product.price} -> ${product.offerPrice}`
    );
  });
};

main();
