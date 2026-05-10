const cleanSearchText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bmobile phones?\b/g, "mobile")
    .replace(/\bsmart phones?\b/g, "smartphone")
    .replace(/\bcell phones?\b/g, "cellphone")
    .replace(/\bhead phones?\b/g, "headphone")
    .replace(/\bear phones?\b/g, "earphone")
    .replace(/\bt shirts?\b/g, "tshirt")
    .replace(/\binner wear\b/g, "innerwear")
    .replace(/\bunder wear\b/g, "underwear")
    .replace(/\bfoot wear\b/g, "footwear")
    .replace(/\btop wear\b/g, "topwear")
    .replace(/\bbottom wear\b/g, "bottomwear")
    .replace(/\bwinter wear\b/g, "winterwear")
    .replace(/\bsleep wear\b/g, "sleepwear")
    .replace(/\brain wear\b/g, "rainwear")
    .replace(/\btrack suit\b/g, "tracksuit")
    .replace(/\bmen s\b/g, "mens")
    .replace(/\bwomen s\b/g, "womens")
    .replace(/\s+/g, " ")
    .trim();

const toSearchTokens = (value) => cleanSearchText(value).split(" ").filter(Boolean);

const MIN_PARTIAL_MATCH_LENGTH = 3;

const QUERY_TOKEN_ALIASES = {
  accessory: ["accessories"],
  accessories: ["accessory"],
  camera: ["dslr", "mirrorless"],
  cellphone: ["mobile", "smartphone", "iphone", "android"],
  console: ["playstation", "nintendo", "switch"],
  earphone: ["headphone", "earbud", "airpod"],
  headphone: ["earphone", "earbud", "airpod"],
  laptop: ["notebook", "ultrabook", "chromebook", "macbook", "computer", "desktop", "pc"],
  inner: ["innerwear", "underwear", "brief", "briefs", "boxer", "boxers", "trunk", "trunks", "vest", "vests", "panty", "panties"],
  innerwear: ["underwear", "inner", "brief", "briefs", "boxer", "boxers", "trunk", "trunks", "vest", "vests", "panty", "panties"],
  mobile: ["smartphone", "iphone", "android", "cellphone"],
  phone: ["mobile", "smartphone", "iphone", "android", "cellphone"],
  shirt: ["tshirt", "tee", "topwear", "top", "polo"],
  tshirt: ["shirt", "tee", "topwear", "top", "polo"],
  top: ["shirt", "shirts", "tshirt", "tee", "polo", "topwear"],
  shoes: ["shoe", "footwear", "sneaker", "sandal"],
  smartphone: ["mobile", "iphone", "android", "cellphone"],
  watch: ["smartwatch"],
  women: ["womens", "womenwear", "womenswear", "ladies", "female"],
  womens: ["women", "womenwear", "womenswear", "ladies", "female"],
  mens: ["men", "menwear", "menswear", "gents", "male"],
  men: ["mens", "menwear", "menswear", "gents", "male"]
};

const SEARCH_FAMILY_ALIASES = {
  mobile: ["mobile", "mobiles", "phone", "phones", "smartphone", "smartphones", "cellphone", "cellphones", "iphone", "android"],
  laptop: ["laptop", "laptops", "notebook", "notebooks", "ultrabook", "ultrabooks", "chromebook", "chromebooks", "macbook", "macbooks", "computer", "computers", "desktop", "desktops", "pc", "pcs"],
  audio: ["earphone", "earphones", "headphone", "headphones", "earbud", "earbuds", "airpod", "airpods"],
  footwear: ["footwear", "mens footwear", "men s footwear", "womens footwear", "women s footwear", "shoe", "shoes", "sandal", "sandals", "sneaker", "sneakers", "loafer", "loafers", "slipper", "slippers", "boot", "boots", "flip flop", "flip flops", "slides", "chappal", "heels", "flats"],
  innerwear: ["inner", "innerwear", "inner wear", "innerwear and swimwear", "underwear", "under wear", "brief", "briefs", "boxer", "boxers", "trunk", "trunks", "vest", "vests", "bra", "bras", "camisole", "panty", "panties", "slip", "slips"],
  winterwear: ["winterwear", "winter wear", "sweatshirt", "sweatshirts", "hoodie", "hoodies", "sweater", "sweaters", "jacket", "jackets", "coat", "coats", "cardigan", "cardigans", "scarf", "scarves", "muffler", "mufflers", "raincoat", "raincoats"],
  topwear: ["topwear", "shirt", "shirts", "tshirt", "tshirts", "tee", "tees", "polo", "polos", "top", "tops", "casual shirt", "formal shirt"],
  bottomwear: ["bottomwear", "pant", "pants", "jean", "jeans", "trouser", "trousers", "short", "shorts", "track pant", "track pants", "jogger", "joggers", "legging", "leggings", "skirt", "skirts"],
  sleepwear: ["sleepwear", "sleep wear", "nightwear", "night wear", "pajama", "pajamas", "pyjama", "pyjamas", "loungewear", "lounge wear"],
  tracksuits: ["tracksuit", "tracksuits", "track suit", "track suits"],
  blazers: ["blazer", "blazers", "waistcoat", "waistcoats", "suit", "suits"],
  ethnic: ["ethnic", "kurta", "kurtas", "saree", "sarees", "lehenga", "lehengas", "dhoti", "salwar", "sherwani"],
  watch: ["watch", "watches", "smartwatch", "smartwatches"],
  camera: ["camera", "cameras", "dslr", "mirrorless"],
  console: ["console", "consoles", "playstation", "nintendo", "switch"],
  accessories: ["accessory", "accessories", "clothing accessories", "bags wallets belts", "bag", "bags", "wallet", "wallets", "belt", "belts", "speaker", "speakers", "projector", "mouse", "mice", "controller", "controllers", "tie", "ties", "cufflink", "cufflinks", "cap", "caps", "suspenders", "bandana"],
  rainwear: ["rainwear", "rain wear", "raincoat", "raincoats"]
};

const SEARCH_FAMILY_PRIORITY = [
  "mobile",
  "laptop",
  "audio",
  "watch",
  "camera",
  "console",
  "footwear",
  "innerwear",
  "winterwear",
  "sleepwear",
  "tracksuits",
  "blazers",
  "topwear",
  "bottomwear",
  "ethnic",
  "rainwear",
  "accessories"
];

const SEARCH_FAMILY_TOKEN_LOOKUP = new Map();
const SEARCH_FAMILY_PHRASE_LOOKUP = new Map();

Object.entries(SEARCH_FAMILY_ALIASES).forEach(([family, terms]) => {
  terms.forEach((term) => {
    const cleanedTerm = cleanSearchText(term);
    if (!cleanedTerm) return;

    if (cleanedTerm.includes(" ")) {
      SEARCH_FAMILY_PHRASE_LOOKUP.set(cleanedTerm, family);
    } else {
      SEARCH_FAMILY_TOKEN_LOOKUP.set(cleanedTerm, family);
    }
  });
});

const MAX_TOKEN_VARIANTS = 24;

const getTokenVariants = (token) => {
  const variants = [];
  const seen = new Set();
  const queue = [token];

  while (queue.length > 0 && variants.length < MAX_TOKEN_VARIANTS) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }

    seen.add(current);
    variants.push(current);

    if (current.length > 3 && current.endsWith("s")) {
      queue.push(current.slice(0, -1));
    }

    const aliases = QUERY_TOKEN_ALIASES[current];
    if (Array.isArray(aliases)) {
      aliases.forEach((alias) => {
        const aliasText = cleanSearchText(alias);
        if (aliasText && !seen.has(aliasText)) {
          queue.push(aliasText);
        }
      });
    }
  }

  return variants;
};

const toNormalizedSearchText = (values = []) =>
  cleanSearchText(Array.isArray(values) ? values.join(" ") : values);

const detectSearchFamilies = (values = []) => {
  const families = new Set();
  const normalizedText = toNormalizedSearchText(values);
  const tokens = Array.isArray(values) ? values : toSearchTokens(values);

  if (normalizedText) {
    SEARCH_FAMILY_PHRASE_LOOKUP.forEach((family, phrase) => {
      if (normalizedText.includes(phrase)) {
        families.add(family);
      }
    });
  }

  tokens.forEach((token) => {
    getTokenVariants(token).forEach((variant) => {
      const family = SEARCH_FAMILY_TOKEN_LOOKUP.get(cleanSearchText(variant));
      if (family) {
        families.add(family);
      }
    });
  });

  return families;
};

export const getPrimarySearchFamily = (values = []) => {
  const families = detectSearchFamilies(values);
  for (const family of SEARCH_FAMILY_PRIORITY) {
    if (families.has(family)) return family;
  }
  return null;
};

export const normalizeSearchText = cleanSearchText;

export const buildProductSearchText = (product = {}) =>
  cleanSearchText(
    [
      product?.name,
      product?.title,
      product?.category,
      product?.brand,
      product?.slug,
      product?.datasetMeta?.brand,
      product?.datasetMeta?.category,
      product?.datasetMeta?.slug
    ]
      .filter(Boolean)
      .join(" ")
  );

export const buildProductSearchTokens = (product = {}) => toSearchTokens(buildProductSearchText(product));

export const buildSearchTerms = (query) => {
  const normalizedQuery = cleanSearchText(query);
  if (!normalizedQuery) return [];

  const terms = new Set([normalizedQuery]);

  toSearchTokens(normalizedQuery).forEach((token) => {
    getTokenVariants(token).forEach((variant) => {
      if (variant.length > 1) {
        terms.add(variant);
      }
    });
  });

  return Array.from(terms);
};

export const prepareSearchQuery = (query) => {
  const normalizedQuery = cleanSearchText(query);
  const queryTokens = normalizedQuery ? toSearchTokens(normalizedQuery) : [];

  return {
    normalizedQuery,
    queryTokens,
    queryFamily: normalizedQuery ? getPrimarySearchFamily(normalizedQuery) : null
  };
};

const scoreFieldMatch = (fieldValue, query) => {
  const normalizedField = cleanSearchText(fieldValue);
  const normalizedQuery = cleanSearchText(query);

  if (!normalizedField || !normalizedQuery) return 0;
  if (normalizedField === normalizedQuery) return 3;
  if (normalizedField.startsWith(normalizedQuery)) return 2;
  if (normalizedField.includes(normalizedQuery)) return 1;
  return 0;
};

const countMatchedQueryTokens = (candidateTokens, queryTokens) => {
  if (!Array.isArray(candidateTokens) || !Array.isArray(queryTokens) || candidateTokens.length === 0 || queryTokens.length === 0) {
    return 0;
  }

  return queryTokens.reduce((count, queryToken) => {
    const variants = getTokenVariants(queryToken);
    const hasMatch = variants.some((variant) =>
      candidateTokens.some((candidateToken) => tokenMatchesVariant(candidateToken, variant))
    );

    return hasMatch ? count + 1 : count;
  }, 0);
};

const isAllowedTokenSuffix = (queryVariant, suffix) => {
  if (!suffix) return true;
  if (/^\d+$/.test(suffix)) return true;
  if (suffix === "s" || suffix === "es") return true;
  if (queryVariant.endsWith("y") && suffix === "ies") return true;
  return false;
};

const tokenMatchesVariant = (candidateToken, queryVariant) => {
  if (!candidateToken || !queryVariant) return false;
  if (candidateToken === queryVariant) return true;

  if (
    candidateToken.length < MIN_PARTIAL_MATCH_LENGTH ||
    queryVariant.length < MIN_PARTIAL_MATCH_LENGTH
  ) {
    return false;
  }

  if (!candidateToken.startsWith(queryVariant)) {
    return false;
  }

  const suffix = candidateToken.slice(queryVariant.length);
  return isAllowedTokenSuffix(queryVariant, suffix);
};

const tokensMatchAtAll = (candidateTokens, queryTokens) => {
  if (!Array.isArray(candidateTokens) || !Array.isArray(queryTokens) || candidateTokens.length === 0 || queryTokens.length === 0) {
    return false;
  }

  return queryTokens.every((queryToken) => {
    const variants = getTokenVariants(queryToken);
    return variants.some((variant) =>
      candidateTokens.some((candidateToken) => tokenMatchesVariant(candidateToken, variant))
    );
  });
};

export const matchesSearchTokens = (searchTokens, query, preparedQuery = null) => {
  const normalizedQuery = preparedQuery?.normalizedQuery ?? cleanSearchText(query);
  if (!normalizedQuery) return true;

  const candidateTokens = Array.isArray(searchTokens) ? searchTokens : toSearchTokens(searchTokens);
  const queryTokens = preparedQuery?.queryTokens ?? toSearchTokens(normalizedQuery);
  if (candidateTokens.length === 0 || queryTokens.length === 0) return false;

  const exactTokenMatch = tokensMatchAtAll(candidateTokens, queryTokens);
  return exactTokenMatch;
};

export const matchesSearchQuery = (searchText, query) => matchesSearchTokens(toSearchTokens(searchText), query);

export const getProductSearchScore = (product = {}, query, precomputed = null, preparedQuery = null) => {
  const queryState = preparedQuery ?? prepareSearchQuery(query);
  const normalizedQuery = queryState.normalizedQuery;
  if (!normalizedQuery) return 0;

  const searchTokens = Array.isArray(precomputed?.searchTokens)
    ? precomputed.searchTokens
    : buildProductSearchTokens(product);
  const nameText = precomputed?.nameText ?? cleanSearchText(product?.name ?? product?.title);
  const categoryText = precomputed?.categoryText ?? cleanSearchText(product?.category);
  const brandText = precomputed?.brandText ?? cleanSearchText(product?.brand ?? product?.datasetMeta?.brand);
  const slugText = precomputed?.slugText ?? cleanSearchText(product?.slug ?? product?.datasetMeta?.slug);
  const queryTokens = queryState.queryTokens;
  const queryFamily = queryState.queryFamily;
  const candidateFamily = queryFamily
    ? (precomputed?.searchFamily ?? getPrimarySearchFamily(searchTokens))
    : null;

  if (!matchesSearchTokens(searchTokens, normalizedQuery, queryState)) {
    return 0;
  }

  const nameTokens = toSearchTokens(nameText);

  let score = 0;

  score = Math.max(score, scoreFieldMatch(nameText, normalizedQuery) * 100000);
  score = Math.max(score, scoreFieldMatch(categoryText, normalizedQuery) * 60000);
  score = Math.max(score, scoreFieldMatch(brandText, normalizedQuery) * 55000);
  score = Math.max(score, scoreFieldMatch(slugText, normalizedQuery) * 52000);

  const nameTokenMatches = countMatchedQueryTokens(nameTokens, queryTokens);
  if (nameTokenMatches > 0) {
    score = Math.max(score, 70000 + (nameTokenMatches * 1000));
  }

  const broadTokenMatches = countMatchedQueryTokens(searchTokens, queryTokens);
  if (broadTokenMatches > 0) {
    score = Math.max(score, 20000 + (broadTokenMatches * 1000));
  }

  if (queryFamily && candidateFamily === queryFamily) {
    score = Math.max(score, 90000);
  }

  return score;
};

export const compareProductsBySearchRelevance = (a, b, query) => {
  const scoreDiff = getProductSearchScore(b, query) - getProductSearchScore(a, query);
  if (scoreDiff !== 0) return scoreDiff;

  const ratingDiff = Number(b?.rating || 0) - Number(a?.rating || 0);
  if (ratingDiff !== 0) return ratingDiff;

  const reviewDiff = Number(b?.ratingsCount || 0) - Number(a?.ratingsCount || 0);
  if (reviewDiff !== 0) return reviewDiff;

  return Number(b?.date || 0) - Number(a?.date || 0);
};
