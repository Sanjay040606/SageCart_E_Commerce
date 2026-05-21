const CATALOG_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const GLOBAL_CACHE_KEY = "__sagecartCatalogSnapshotCache__";
const CATALOG_SNAPSHOT_VERSION = 3;

const getCatalogSnapshotState = () => {
  if (!globalThis[GLOBAL_CACHE_KEY]) {
    globalThis[GLOBAL_CACHE_KEY] = {
      snapshot: null,
      cachedAt: 0
    };
  }

  return globalThis[GLOBAL_CACHE_KEY];
};

export const getCachedCatalogSnapshot = () => {
  const state = getCatalogSnapshotState();
  if (!state.snapshot) return null;

  if (state.version !== CATALOG_SNAPSHOT_VERSION) {
    state.snapshot = null;
    state.cachedAt = 0;
    state.version = CATALOG_SNAPSHOT_VERSION;
    return null;
  }

  if (Date.now() - state.cachedAt > CATALOG_SNAPSHOT_TTL_MS) {
    state.snapshot = null;
    state.cachedAt = 0;
    state.version = CATALOG_SNAPSHOT_VERSION;
    return null;
  }

  return state.snapshot;
};

export const setCachedCatalogSnapshot = (snapshot) => {
  const state = getCatalogSnapshotState();
  state.snapshot = snapshot;
  state.cachedAt = Date.now();
  state.version = CATALOG_SNAPSHOT_VERSION;
};

export const invalidateCatalogSnapshot = () => {
  const state = getCatalogSnapshotState();
  state.snapshot = null;
  state.cachedAt = 0;
  state.version = CATALOG_SNAPSHOT_VERSION;
};
