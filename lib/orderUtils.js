const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const extractObjectId = (value) => {
  const text = cleanText(value);
  if (!text) return "";

  const directMatch = text.match(/^[a-f0-9]{24}$/i);
  if (directMatch) return directMatch[0];

  const embeddedMatch = text.match(/\b[a-f0-9]{24}\b/i);
  return embeddedMatch ? embeddedMatch[0] : "";
};

export const resolveOrderReferenceId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return cleanText(value._id ?? value.id ?? value.userId ?? value.address ?? "");
  }

  return cleanText(value);
};

export const resolveOrderProductId = (item) => {
  const candidate = typeof item === "object" && item !== null
    ? item.product ?? item.productId ?? item._id ?? item.id
    : item;

  if (candidate && typeof candidate === "object") {
    return extractObjectId(candidate._id ?? candidate.id ?? candidate.productId ?? "");
  }

  return extractObjectId(candidate);
};

export const normalizePositiveInteger = (value) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const normalizeOrderItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const productId = resolveOrderProductId(item);
      const quantity = normalizePositiveInteger(item?.quantity);

      if (!productId || quantity <= 0) return null;

      return {
        ...item,
        product: productId,
        productId,
        quantity
      };
    })
    .filter(Boolean);
