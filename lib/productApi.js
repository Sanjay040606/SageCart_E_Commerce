const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIdString = (value) => (value == null ? "" : String(value));

const getReviewStats = (product) => {
  const reviews = Array.isArray(product?.reviews) ? product.reviews : [];

  if (reviews.length > 0) {
    const ratings = reviews
      .map((review) => Number(review?.rating))
      .filter((rating) => Number.isFinite(rating));

    const rating = ratings.length > 0
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1))
      : null;

    return {
      rating,
      ratingsCount: reviews.length
    };
  }

  const datasetRating = Number(product?.datasetMeta?.rating);
  const datasetRatingsCount = Number(product?.datasetMeta?.ratingsCount);

  return {
    rating: Number.isFinite(datasetRating) ? datasetRating : null,
    ratingsCount: Number.isFinite(datasetRatingsCount) ? datasetRatingsCount : 0
  };
};

export const summarizeCatalogProduct = (product) => {
  const reviewStats = getReviewStats(product);
  const datasetMeta = product?.datasetMeta || {};
  const summaryDatasetMeta = {
    brand: cleanText(datasetMeta.brand || product?.brand || ""),
    slug: cleanText(datasetMeta.slug || product?.slug || ""),
    rating: Number.isFinite(Number(datasetMeta.rating ?? product?.rating))
      ? Number(datasetMeta.rating ?? product?.rating)
      : null,
    ratingsCount: Number.isFinite(Number(datasetMeta.ratingsCount ?? product?.ratingsCount))
      ? Number(datasetMeta.ratingsCount ?? product?.ratingsCount)
      : 0,
    discountPercent: toNumber(datasetMeta.discountPercent ?? product?.discountPercent, 0),
    sellerName: cleanText(datasetMeta.sellerName || ""),
    sizes: toArray(datasetMeta.sizes),
    variations: toArray(datasetMeta.variations),
    variantOptions: toArray(datasetMeta.variantOptions)
  };

  return {
    _id: toIdString(product?._id),
    source: cleanText(product?.source || datasetMeta.source || "manual"),
    sourceId: cleanText(product?.sourceId || datasetMeta.sourceId || ""),
    userId: product?.userId,
    name: cleanText(product?.name),
    description: cleanText(product?.description),
    price: toNumber(product?.price, 0),
    offerPrice: toNumber(product?.offerPrice, 0),
    image: toArray(product?.image),
    category: cleanText(product?.category),
    promoCode: cleanText(product?.promoCode),
    stock: toNumber(product?.stock, 0),
    status: cleanText(product?.status),
    colors: toArray(product?.colors),
    sizes: toArray(product?.sizes),
    variantOptions: toArray(product?.variantOptions),
    variantMode: cleanText(product?.variantMode),
    date: toNumber(product?.date, Date.now()),
    brand: summaryDatasetMeta.brand,
    slug: summaryDatasetMeta.slug,
    rating: reviewStats.rating,
    ratingsCount: reviewStats.ratingsCount,
    discountPercent: summaryDatasetMeta.discountPercent,
    sellerName: summaryDatasetMeta.sellerName,
    datasetMeta: summaryDatasetMeta
  };
};

export const buildCatalogSummaryPipeline = () => [
  {
    $addFields: {
      __reviewCount: {
        $size: {
          $ifNull: ["$reviews", []]
        }
      },
      __reviewRating: {
        $cond: [
          {
            $gt: [
              {
                $size: {
                  $ifNull: ["$reviews", []]
                }
              },
              0
            ]
          },
          {
            $round: [
              {
                $avg: "$reviews.rating"
              },
              1
            ]
          },
          "$datasetMeta.rating"
        ]
      }
    }
  },
  {
    $project: {
      _id: { $toString: "$_id" },
      source: { $ifNull: ["$source", "manual"] },
      sourceId: { $ifNull: ["$sourceId", ""] },
      userId: 1,
      name: 1,
      description: 1,
      price: 1,
      offerPrice: 1,
      image: 1,
      category: 1,
      promoCode: 1,
      stock: 1,
      status: 1,
      colors: 1,
      sizes: 1,
      variantOptions: 1,
      variantMode: 1,
      date: 1,
      brand: { $ifNull: ["$brand", { $ifNull: ["$datasetMeta.brand", ""] }] },
      slug: { $ifNull: ["$datasetMeta.slug", ""] },
      rating: { $ifNull: ["$__reviewRating", null] },
      ratingsCount: { $ifNull: ["$__reviewCount", 0] },
      discountPercent: { $ifNull: ["$datasetMeta.discountPercent", 0] },
      sellerName: { $ifNull: ["$datasetMeta.sellerName", ""] },
      datasetMeta: {
        brand: { $ifNull: ["$datasetMeta.brand", { $ifNull: ["$brand", ""] }] },
        slug: { $ifNull: ["$datasetMeta.slug", ""] },
        rating: { $ifNull: ["$datasetMeta.rating", null] },
        ratingsCount: { $ifNull: ["$datasetMeta.ratingsCount", 0] },
        discountPercent: { $ifNull: ["$datasetMeta.discountPercent", 0] },
        sellerName: { $ifNull: ["$datasetMeta.sellerName", ""] },
        sizes: { $ifNull: ["$datasetMeta.sizes", []] },
        variations: { $ifNull: ["$datasetMeta.variations", []] },
        variantOptions: { $ifNull: ["$datasetMeta.variantOptions", []] }
      }
    }
  }
];
