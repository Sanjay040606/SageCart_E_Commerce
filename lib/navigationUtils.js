export const DEFAULT_RETURN_TO_PATH = "/all-products";
export const ALL_PRODUCTS_RETURN_TO_PATH_KEY = "sagecart:all-products-return-to:v1";

export const sanitizeReturnToPath = (value, fallback = DEFAULT_RETURN_TO_PATH) => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
};

export const buildCurrentReturnToPath = () => {
  if (typeof window === "undefined") return DEFAULT_RETURN_TO_PATH;

  const url = new URL(window.location.href);
  url.searchParams.delete("returnTo");

  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  return nextPath || DEFAULT_RETURN_TO_PATH;
};

export const readPersistedAllProductsReturnToPath = () => {
  if (typeof window === "undefined") return DEFAULT_RETURN_TO_PATH;

  try {
    const raw = window.sessionStorage.getItem(ALL_PRODUCTS_RETURN_TO_PATH_KEY);
    return sanitizeReturnToPath(raw, DEFAULT_RETURN_TO_PATH);
  } catch {
    return DEFAULT_RETURN_TO_PATH;
  }
};

export const writePersistedAllProductsReturnToPath = (path) => {
  if (typeof window === "undefined") return;

  try {
    const sanitizedPath = sanitizeReturnToPath(path, DEFAULT_RETURN_TO_PATH);
    window.sessionStorage.setItem(ALL_PRODUCTS_RETURN_TO_PATH_KEY, sanitizedPath);
  } catch {
    // Ignore storage failures.
  }
};

export const clearPersistedAllProductsReturnToPath = () => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(ALL_PRODUCTS_RETURN_TO_PATH_KEY);
  } catch {
    // Ignore storage failures.
  }
};
