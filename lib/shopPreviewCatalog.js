import { seedProductCatalog } from "./productSeedCatalog";

const PREVIEW_LIMIT = 8;

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getProductStatusFromStock = (stock) => {
  if (stock === 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "active";
};

const buildPreviewProduct = (product, index) => {
  const stock = Math.max(0, Number(product?.stock) || 0);
  const slug = slugify(product?.name || `preview-${index}`);

  return {
    _id: `preview-${index}-${slug}`,
    source: "preview",
    sourceId: `preview-${index}`,
    userId: null,
    name: String(product?.name ?? ""),
    description: String(product?.description ?? ""),
    price: Number(product?.price) || 0,
    offerPrice: Number(product?.offerPrice) || 0,
    image: Array.isArray(product?.image) ? product.image : [],
    category: String(product?.category ?? ""),
    promoCode: String(product?.promoCode ?? ""),
    stock,
    status: getProductStatusFromStock(stock),
    colors: [],
    sizes: [],
    variantOptions: [],
    variantMode: "",
    date: Date.now() - index * 86_400_000,
    brand: "",
    slug,
    rating: null,
    ratingsCount: 0,
    discountPercent: 0,
    sellerName: "",
    datasetMeta: {
      source: "preview",
      brand: "",
      slug,
      rating: null,
      ratingsCount: 0,
      discountPercent: 0,
      sellerName: "",
      sizes: [],
      variations: [],
      variantOptions: []
    }
  };
};

export const buildShopPreviewSnapshot = (limit = PREVIEW_LIMIT) => {
  const previewProducts = seedProductCatalog.slice(0, limit).map(buildPreviewProduct);
  const categories = Array.from(
    new Set(
      previewProducts
        .map((product) => String(product?.category ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  return {
    products: previewProducts,
    pagination: {
      page: 1,
      limit: previewProducts.length || limit,
      total: previewProducts.length,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
      start: previewProducts.length > 0 ? 1 : 0,
      end: previewProducts.length
    },
    catalogStats: {
      totalProducts: previewProducts.length,
      categories
    },
    isPreview: true
  };
};
