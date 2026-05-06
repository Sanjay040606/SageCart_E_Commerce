import fs from "fs";
import path from "path";
import { compactCatalogProducts } from "../lib/catalogCompaction.js";

const INPUT_PATH = path.resolve(process.cwd(), "public/products_dataset/Combined_dataset.csv");
const OUTPUT_PATH = path.resolve(process.cwd(), "public/products_dataset/sagecart_products.json");
const SOURCE_NAME = "myntra-dataset";
const SOURCE_ORIGIN = "combined-dataset";

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
  const normalized = cleanText(value).replace(/[^0-9.]/g, "");
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

const parseList = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);

  const parsed = safeJsonParse(value, null);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];

  const text = cleanText(value);
  if (!text) return [];

  if (text.includes("http") && !text.includes("[")) {
    return text.split(",").map((item) => cleanText(item)).filter(Boolean);
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

const flattenEntries = (value) => {
  const entries = [];
  const parsed = parseList(value);

  parsed.forEach((entry, index) => {
    if (typeof entry === "string") {
      const text = beautifyScrapedText(entry);
      if (text) entries.push({ label: `Feature ${index + 1}`, value: text });
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

const flattenDetails = (value) => {
  const details = {};

  flattenEntries(value).forEach((entry) => {
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

const parseObject = (value) => {
  const parsed = safeJsonParse(value, null);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
};

const parseVariations = (value) => {
  const parsed = parseList(value);
  const entries = [];

  parsed.forEach((entry) => {
    if (typeof entry === "string") {
      const text = cleanText(entry);
      if (text) entries.push({ label: text });
      return;
    }

    if (entry && typeof entry === "object") {
      const nested = Array.isArray(entry.variations) ? entry.variations : [];
      if (nested.length > 0) {
        nested.forEach((nestedValue) => {
          const label = cleanText(nestedValue);
          if (label) entries.push({ label, type: cleanText(entry.name || entry.label || "") || "variant" });
        });
        return;
      }

      const label = cleanText(
        entry.label ||
          entry.name ||
          entry.value ||
          entry.color ||
          entry.size ||
          entry.variant ||
          entry.ram ||
          entry.rom ||
          entry.storage ||
          entry.capacity ||
          entry.memory
      );
      if (label) entries.push({ label, type: cleanText(entry.type || "") || "" });
    }
  });

  const seen = new Set();
  return entries.filter((entry) => {
    const signature = `${cleanText(entry.label).toLowerCase()}|${cleanText(entry.type).toLowerCase()}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

const parseSizes = (value) => {
  const parsed = parseList(value);
  return uniqueStrings(
    parsed.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.size || item.label || item.name || item.value || "";
      return "";
    })
  )
    .filter(Boolean)
    .map((size) => ({ size }));
};

const buildCategory = (row) => {
  const category = cleanText(row.category);
  if (category) return category;

  const breadcrumbs = parseList(row.breadcrumbs);
  if (breadcrumbs.length > 0) return cleanText(breadcrumbs[breadcrumbs.length - 1]);

  return "General";
};

const buildCategorySlug = (category) =>
  slugify(category || "general")
    .replace(/^-+|-+$/g, "");

const buildDisplayName = (brand, description) => {
  const cleanBrand = cleanText(brand);
  const cleanDescription = cleanText(description);
  if (!cleanBrand) return cleanDescription;
  if (!cleanDescription) return cleanBrand;
  if (cleanDescription.toLowerCase().startsWith(cleanBrand.toLowerCase())) return cleanDescription;
  return `${cleanBrand} ${cleanDescription}`;
};

const inferVariantType = (label) => {
  const text = cleanText(label).toLowerCase();
  if (/\b(?:xxxl|xxl|xl|small|medium|large|size|free size)\b/.test(text)) return "size";
  if (/\b(?:black|white|blue|red|green|yellow|orange|purple|pink|silver|gold|gray|grey|brown|beige|navy|maroon|violet|clear|transparent|merah jambu|biru tua|biru muda|biru dongker|hitam|putih|merah|hijau|kuning|cokelat|abu|oranye|ungu|tosca)\b/.test(text)) {
    return "color";
  }
  return "variant";
};

const buildVariantOptions = (row, image, pricePair) => {
  const options = [];
  const variations = parseVariations(row.variations);

  variations.forEach((entry, index) => {
    const label = cleanText(entry.label);
    if (!label) return;

    const type = inferVariantType(label) || cleanText(entry.type || "");
    options.push({
      id: `${slugify(label)}-${index}`,
      label,
      type,
      description:
        type === "color"
          ? `Color: ${label}`
          : type === "size"
            ? `Selected size: ${label}`
            : `Selected variant: ${label}`,
      image: image ? [image].filter(Boolean) : [],
      priceInr: Number.isFinite(Number(entry.priceInr)) ? Number(entry.priceInr) : pricePair.offerPrice,
      originalPriceInr: Number.isFinite(Number(entry.originalPriceInr)) ? Number(entry.originalPriceInr) : pricePair.price,
      stock: Number.isFinite(Number(entry.stock)) ? Number(entry.stock) : null
    });
  });

  const sizeOptions = parseSizes(row.sizes);
  sizeOptions.forEach((entry, index) => {
    const label = cleanText(entry.size);
    if (!label) return;
    options.push({
      id: `size-${index}-${slugify(label)}`,
      label,
      type: "size",
      description: `Selected size: ${label}`,
      image: image ? [image].filter(Boolean) : [],
      priceInr: pricePair.offerPrice,
      originalPriceInr: pricePair.price
    });
  });

  const seen = new Set();
  return options.filter((option) => {
    const signature = `${cleanText(option.label).toLowerCase()}|${cleanText(option.type).toLowerCase()}|${cleanText(option.description).toLowerCase()}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

const buildPricePair = (initial, final) => {
  const initialPrice = parseMoney(initial);
  const finalPrice = parseMoney(final);
  const candidates = [initialPrice, finalPrice].filter((value) => Number.isFinite(value) && value > 0);
  if (candidates.length === 0) return null;

  return {
    price: Number(Math.max(...candidates).toFixed(2)),
    offerPrice: Number(Math.min(...candidates).toFixed(2))
  };
};

const deriveStock = (row) => {
  const ratingsCount = parseCount(row.ratings_count, 0);
  if (ratingsCount <= 0) return 8;
  return Math.max(3, Math.min(30, Math.round(ratingsCount / 5)));
};

const buildReviewHighlights = (row) => {
  const parsed = [];

  const source = safeJsonParse(row.what_customers_said, null);
  if (Array.isArray(source)) {
    source.forEach((item) => parsed.push(item));
  } else if (typeof row.what_customers_said === "string") {
    row.what_customers_said
      .split(/[\n;|]+/)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .forEach((item) => parsed.push(item));
  }

  flattenEntries(row.product_specifications).forEach((entry) => {
    const label = cleanText(entry.label);
    const value = cleanText(entry.value);
    if (label && value) parsed.push(`${label}: ${value}`);
  });

  return uniqueStrings(parsed.map((item) => beautifyScrapedText(item))).slice(0, 6);
};

const buildProductRow = (row, index) => {
  const productId = cleanText(row.product_id || row.asin || row.input_asin || row.parent_asin || `${index + 1}`);
  const brand = cleanText(row.title || row.brand || "No Brand");
  const description = beautifyScrapedText(row.product_description || "");
  const displayName = buildDisplayName(brand, description) || `Product ${productId}`;
  const pricePair = buildPricePair(row.initial_price, row.final_price);
  if (!pricePair) return null;

  const images = parseImages(row.images || row.image || row.image_url);
  if (images.length === 0) return null;

  const category = buildCategory(row);
  const variantOptions = buildVariantOptions(row, images[0], pricePair);
  const colors = uniqueStrings(variantOptions.filter((option) => option.type === "color").map((option) => option.label));
  const sizes = variantOptions.filter((option) => option.type === "size").map((option) => ({ size: option.label }));
  const reviewHighlights = buildReviewHighlights(row);
  const breadcrumbs = uniqueStrings(parseList(row.breadcrumbs)).slice(0, 5);
  const sellerInfo = parseObject(row.seller_information);
  const bestOffer = parseObject(row.best_offer);
  const moreOffers = parseList(row.more_offers);

  const product = {
    source: SOURCE_NAME,
    sourceOrigin: SOURCE_ORIGIN,
    sourceId: productId,
    brand,
    title: brand,
    name: displayName,
    description: description || cleanText(row.product_description) || displayName,
    price: pricePair.price,
    offerPrice: pricePair.offerPrice,
    image: images,
    currency: cleanText(row.currency) || "INR",
    category,
    categorySlug: buildCategorySlug(category),
    slug: slugify(displayName),
    rating: parseRating(row.rating),
    ratingsCount: parseCount(row.ratings_count, 0),
    discountPercent: (() => {
      const discount = parseCount(row.discount, 0);
      if (discount > 0 && discount < 100) return Math.round(discount);
      if (pricePair.price > 0 && pricePair.offerPrice > 0) {
        return Math.max(0, Math.min(100, Math.round((1 - pricePair.offerPrice / pricePair.price) * 100)));
      }
      return 0;
    })(),
    stock: deriveStock(row),
    status: "active",
    colors,
    reviews: [],
    deliveryOptions: uniqueStrings(parseList(row.delivery_options).map((item) => beautifyScrapedText(item))).slice(0, 10),
    breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : [category],
    productDetails: flattenDetails(row.product_details),
    productSpecifications: flattenEntries(row.product_specifications).slice(0, 20),
    sellerName: cleanText(row.seller_name || brand),
    sellerInformation: sellerInfo || (row.seller_name ? { name: cleanText(row.seller_name), platform: "Myntra", source: "Combined dataset" } : null),
    sizes,
    videos: parseList(row.videos),
    variations: variantOptions,
    whatCustomersSaid: reviewHighlights,
    reviewHighlights,
    variantOptions,
    bestOffer:
      bestOffer && typeof bestOffer === "object"
        ? bestOffer
        : {
            label: "Best price",
            priceInr: pricePair.offerPrice,
            originalPriceInr: pricePair.price
          },
    moreOffers,
    sourceUrl: "",
    date: Date.now() - index * 86400000,
    datasetMeta: {
      sourceOrigin: SOURCE_ORIGIN,
      sourceCurrency: cleanText(row.currency) || "INR",
      productId,
      reviewHighlights,
      productDetails: flattenDetails(row.product_details),
      productSpecifications: flattenEntries(row.product_specifications).slice(0, 20),
      deliveryOptions: uniqueStrings(parseList(row.delivery_options).map((item) => beautifyScrapedText(item))).slice(0, 10),
      breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : [category],
      sellerInformation: sellerInfo || null,
      variantOptions,
      colors,
      sizes
    }
  };

  return product;
};

const main = () => {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Dataset not found: ${INPUT_PATH}`);
  }

  const csvText = fs.readFileSync(INPUT_PATH, "utf8");
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("Combined dataset does not contain any rows.");
  }

  const headers = rows[0].map((header) => cleanText(header));
  const records = rows
    .slice(1)
    .filter((row) => row.some((cell) => cleanText(cell)))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });

  const converted = records.map((row, index) => buildProductRow(row, index)).filter(Boolean);
  const compacted = compactCatalogProducts(converted);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(compacted, null, 2));

  const categoryCounts = compacted.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => `${category}: ${count}`);

  console.log(`Converted ${records.length} Combined rows into ${compacted.length} SageCart products.`);
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
