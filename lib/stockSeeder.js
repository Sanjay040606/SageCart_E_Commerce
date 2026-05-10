const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_HIGH_STOCK = 500;
const DEFAULT_LOW_STOCK_RANGE = [1, 5];
const DEFAULT_TARGET_COUNTS = {
  high: 5000,
  low: 1000,
  zero: 500
};

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeKey = (value) => cleanText(value).toLowerCase();

const hashString = (value) => {
  const text = normalizeKey(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const getCategoryKey = (product = {}) => {
  const candidates = [
    product?.categorySlug,
    product?.datasetMeta?.categorySlug,
    product?.category,
    product?.datasetMeta?.category,
    product?.datasetMeta?.subCategory,
    product?.datasetMeta?.topCategory,
    product?.datasetMeta?.sourceCategory
  ];

  for (const candidate of candidates) {
    const key = normalizeKey(candidate);
    if (key) return key;
  }

  return "uncategorized";
};

const getProductKey = (product = {}) => {
  const id = cleanText(product?._id ?? product?.id ?? product?.sourceId);
  const name = normalizeKey(product?.name);
  return `${getCategoryKey(product)}|${id || name}`;
};

const compareProducts = (left, right) => {
  const leftHash = hashString(getProductKey(left));
  const rightHash = hashString(getProductKey(right));

  if (leftHash !== rightHash) {
    return leftHash - rightHash;
  }

  const nameDiff = normalizeKey(left?.name).localeCompare(normalizeKey(right?.name));
  if (nameDiff !== 0) return nameDiff;

  return cleanText(left?._id ?? left?.id ?? left?.sourceId).localeCompare(
    cleanText(right?._id ?? right?.id ?? right?.sourceId)
  );
};

const getStatusFromStock = (stock) => {
  if (stock === 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "active";
};

const getScaledTargetCounts = (total, targetCounts = DEFAULT_TARGET_COUNTS) => {
  if (total <= 0) {
    return { high: 0, low: 0, zero: 0 };
  }

  const baseTotal = targetCounts.high + targetCounts.low + targetCounts.zero;
  if (baseTotal <= 0) {
    return { high: total, low: 0, zero: 0 };
  }

  const high = Math.min(
    total,
    Math.max(0, Math.round((total * targetCounts.high) / baseTotal))
  );
  const low = Math.min(
    total - high,
    Math.max(0, Math.round((total * targetCounts.low) / baseTotal))
  );
  const zero = Math.max(0, total - high - low);

  return { high, low, zero };
};

const chooseBestStatus = (budgets, excluded = []) => {
  const excludedSet = new Set(Array.isArray(excluded) ? excluded : [excluded]);
  const candidates = ["high", "low", "zero"].filter(
    (key) => budgets[key] > 0 && !excludedSet.has(key)
  );

  if (candidates.length === 0) {
    return "high";
  }

  candidates.sort((left, right) => budgets[right] - budgets[left]);
  return candidates[0];
};

const chooseDistinctStatusPair = (budgets) => {
  const first = chooseBestStatus(budgets);
  const second = chooseBestStatus(budgets, first);

  if (second === first) {
    return [first, first];
  }

  return [first, second];
};

const getLowStockValue = (product, lowStockRange = DEFAULT_LOW_STOCK_RANGE) => {
  const min = Math.max(1, Number(lowStockRange?.[0]) || DEFAULT_LOW_STOCK_RANGE[0]);
  const max = Math.max(min, Number(lowStockRange?.[1]) || DEFAULT_LOW_STOCK_RANGE[1]);

  if (max === min) {
    return min;
  }

  const spread = max - min + 1;
  const hash = hashString(`${getProductKey(product)}|low-stock`);
  return min + (hash % spread);
};

const resolveStockValue = (product, status, options = {}) => {
  if (status === "high") {
    return Number.isFinite(Number(options.highStockValue))
      ? Number(options.highStockValue)
      : DEFAULT_HIGH_STOCK;
  }

  if (status === "low") {
    return getLowStockValue(product, options.lowStockRange);
  }

  return 0;
};

const updateVariantEntry = (entry, stock, status) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return entry;
  }

  const next = { ...entry };
  const isAvailable = stock > 0;

  next.stock = stock;
  next.available = isAvailable;
  next.outOfStock = !isAvailable;

  if ("status" in next) {
    next.status = status;
  }

  if ("inStock" in next) {
    next.inStock = isAvailable;
  }

  if ("isAvailable" in next) {
    next.isAvailable = isAvailable;
  }

  return next;
};

const updateVariantArray = (value, stock, status) => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((entry) => updateVariantEntry(entry, stock, status));
};

const buildProductPatch = (product, status, options = {}) => {
  const stock = resolveStockValue(product, status, options);
  const resolvedStatus = getStatusFromStock(stock);
  const patch = {
    stock,
    status: resolvedStatus
  };

  if (Array.isArray(product?.variantOptions)) {
    patch.variantOptions = updateVariantArray(product.variantOptions, stock, resolvedStatus);
  }

  if (Array.isArray(product?.variations)) {
    patch.variations = updateVariantArray(product.variations, stock, resolvedStatus);
  }

  if (product?.datasetMeta && typeof product.datasetMeta === "object") {
    const datasetMeta = { ...product.datasetMeta };
    let datasetUpdated = false;

    if (Array.isArray(datasetMeta.variantOptions)) {
      datasetMeta.variantOptions = updateVariantArray(
        datasetMeta.variantOptions,
        stock,
        resolvedStatus
      );
      datasetUpdated = true;
    }

    if (Array.isArray(datasetMeta.variations)) {
      datasetMeta.variations = updateVariantArray(datasetMeta.variations, stock, resolvedStatus);
      datasetUpdated = true;
    }

    if (datasetUpdated) {
      patch.datasetMeta = datasetMeta;
    }
  }

  return {
    stock,
    status: resolvedStatus,
    patch
  };
};

const buildWeightedSequence = (counts) => {
  const sequence = [];
  const total = counts.high + counts.low + counts.zero;

  if (total <= 0) {
    return sequence;
  }

  const states = [
    { key: "high", weight: counts.high, current: 0, priority: 0 },
    { key: "low", weight: counts.low, current: 0, priority: 1 },
    { key: "zero", weight: counts.zero, current: 0, priority: 2 }
  ];

  for (let index = 0; index < total; index += 1) {
    for (const state of states) {
      state.current += state.weight;
    }

    let pick = states[0];
    for (let stateIndex = 1; stateIndex < states.length; stateIndex += 1) {
      const candidate = states[stateIndex];
      if (
        candidate.current > pick.current ||
        (candidate.current === pick.current && candidate.priority < pick.priority)
      ) {
        pick = candidate;
      }
    }

    sequence.push(pick.key);
    pick.current -= total;
  }

  return sequence;
};

const groupProductsByCategory = (products = []) => {
  const groups = new Map();

  for (const product of products) {
    const categoryKey = getCategoryKey(product);
    if (!groups.has(categoryKey)) {
      groups.set(categoryKey, []);
    }

    groups.get(categoryKey).push(product);
  }

  return groups;
};

const assignStatusToProduct = (product, status, options, assignments) => {
  const { stock, status: resolvedStatus, patch } = buildProductPatch(product, status, options);
  const productId = cleanText(product?._id ?? product?.id ?? product?.sourceId ?? product?.name);

  assignments.set(productId, {
    productId,
    categoryKey: getCategoryKey(product),
    name: cleanText(product?.name),
    plannedStatus: status,
    stock,
    status: resolvedStatus,
    patch
  });
};

export const buildStockUpdateOperations = (products = [], options = {}) => {
  const total = products.length;
  const targetCounts = getScaledTargetCounts(
    total,
    options.targetCounts || DEFAULT_TARGET_COUNTS
  );
  const budgets = { ...targetCounts };
  const grouped = groupProductsByCategory(products);
  const orderedGroups = [...grouped.entries()].sort((left, right) => {
    const countDiff = right[1].length - left[1].length;
    if (countDiff !== 0) return countDiff;
    return left[0].localeCompare(right[0]);
  });

  const assignments = new Map();
  const remainingProducts = [];

  for (const [, groupProducts] of orderedGroups) {
    const orderedProducts = [...groupProducts].sort(compareProducts);

    if (orderedProducts.length >= 3 && budgets.high > 0 && budgets.low > 0 && budgets.zero > 0) {
      assignStatusToProduct(orderedProducts[0], "high", options, assignments);
      assignStatusToProduct(orderedProducts[1], "low", options, assignments);
      assignStatusToProduct(orderedProducts[2], "zero", options, assignments);
      budgets.high -= 1;
      budgets.low -= 1;
      budgets.zero -= 1;
      remainingProducts.push(...orderedProducts.slice(3));
      continue;
    }

    if (orderedProducts.length === 2) {
      const [firstStatus, secondStatus] = chooseDistinctStatusPair(budgets);
      assignStatusToProduct(orderedProducts[0], firstStatus, options, assignments);
      assignStatusToProduct(orderedProducts[1], secondStatus, options, assignments);
      budgets[firstStatus] -= 1;
      budgets[secondStatus] -= 1;
      continue;
    }

    if (orderedProducts.length === 1) {
      const status = chooseBestStatus(budgets);
      assignStatusToProduct(orderedProducts[0], status, options, assignments);
      budgets[status] -= 1;
      continue;
    }

    if (orderedProducts.length >= 3) {
      const firstStatus = chooseBestStatus(budgets);
      const secondStatus = chooseBestStatus(budgets, firstStatus);
      const thirdStatus = chooseBestStatus(budgets, [firstStatus, secondStatus]);

      assignStatusToProduct(orderedProducts[0], firstStatus, options, assignments);
      assignStatusToProduct(orderedProducts[1], secondStatus, options, assignments);
      assignStatusToProduct(orderedProducts[2], thirdStatus, options, assignments);
      budgets[firstStatus] -= 1;
      budgets[secondStatus] -= 1;
      budgets[thirdStatus] -= 1;
      remainingProducts.push(...orderedProducts.slice(3));
    }
  }

  const remainingSequence = buildWeightedSequence(budgets);
  const orderedRemainingProducts = remainingProducts.sort(compareProducts);

  orderedRemainingProducts.forEach((product, index) => {
    const status = remainingSequence[index] || chooseBestStatus(budgets);
    assignStatusToProduct(product, status, options, assignments);
  });

  const operations = [];
  const preview = [];
  const assignedCounts = {
    high: 0,
    low: 0,
    zero: 0
  };
  const categoryCounts = new Map();

  for (const product of products) {
    const productId = cleanText(product?._id ?? product?.id ?? product?.sourceId ?? product?.name);
    const assignment = assignments.get(productId);

    if (!assignment) {
      continue;
    }

    assignedCounts[assignment.plannedStatus] += 1;
    categoryCounts.set(
      assignment.categoryKey,
      (categoryCounts.get(assignment.categoryKey) || 0) + 1
    );

    operations.push({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: assignment.patch
        }
      }
    });

    if (preview.length < 8) {
      preview.push({
        name: assignment.name,
        categoryKey: assignment.categoryKey,
        stock: assignment.stock,
        status: assignment.status
      });
    }
  }

  return {
    operations,
    preview,
    summary: {
      total,
      categoryCount: grouped.size,
      targetCounts,
      assignedCounts,
      remainingBudgets: budgets,
      mixedCategories: [...categoryCounts.keys()].length,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      highStockValue: Number.isFinite(Number(options.highStockValue))
        ? Number(options.highStockValue)
        : DEFAULT_HIGH_STOCK,
      lowStockRange: options.lowStockRange || DEFAULT_LOW_STOCK_RANGE
    }
  };
};

export const getStockStatusFromQuantity = getStatusFromStock;
export const resolveStockValueForStatus = resolveStockValue;
export const DEFAULT_STOCK_SEED_PROFILE = DEFAULT_TARGET_COUNTS;
