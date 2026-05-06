const cleanSearchText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toSearchTokens = (value) => cleanSearchText(value).split(" ").filter(Boolean);

const getTokenVariants = (token) => {
  const variants = new Set([token]);

  if (token.length > 3 && token.endsWith("s")) {
    variants.add(token.slice(0, -1));
  }

  return Array.from(variants);
};

export const normalizeSearchText = cleanSearchText;

export const buildProductSearchText = (product = {}) =>
  cleanSearchText(
    [
      product?.name,
      product?.title,
      product?.category,
      product?.description,
      product?.brand,
      product?.slug,
      product?.datasetMeta?.brand,
      product?.datasetMeta?.category,
      product?.datasetMeta?.sellerName,
      Array.isArray(product?.colors) ? product.colors.join(" ") : "",
      Array.isArray(product?.sizes)
        ? product.sizes.map((entry) => entry?.size ?? entry).filter(Boolean).join(" ")
        : "",
      Array.isArray(product?.variantOptions)
        ? product.variantOptions.map((entry) => entry?.label ?? entry?.name ?? entry?.title ?? "").join(" ")
        : ""
    ]
      .filter(Boolean)
      .join(" ")
  );

export const buildProductSearchTokens = (product = {}) => toSearchTokens(buildProductSearchText(product));

export const matchesSearchTokens = (searchTokens, query) => {
  const normalizedQuery = cleanSearchText(query);
  if (!normalizedQuery) return true;

  const candidateTokens = Array.isArray(searchTokens) ? searchTokens : toSearchTokens(searchTokens);
  const queryTokens = toSearchTokens(normalizedQuery);
  if (candidateTokens.length === 0 || queryTokens.length === 0) return false;

  return queryTokens.every((queryToken) => {
    const variants = getTokenVariants(queryToken);
    return variants.some((variant) =>
      candidateTokens.some((searchToken) =>
        searchToken === variant ||
        searchToken.startsWith(variant) ||
        variant.startsWith(searchToken)
      )
    );
  });
};

export const matchesSearchQuery = (searchText, query) => matchesSearchTokens(toSearchTokens(searchText), query);
