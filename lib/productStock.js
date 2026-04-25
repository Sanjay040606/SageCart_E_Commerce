import Product from "@/models/Product";

export const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock',
  LOW_STOCK: 'low_stock'
};

export const LOW_STOCK_THRESHOLD = 5;

/**
 * Updates product stock and status based on quantity change
 * @param {string} productId - Product ID
 * @param {number} quantityChange - Positive for stock increase, negative for decrease
 * @returns {Promise<Object>} Updated product
 */
export const updateProductStock = async (productId, quantityChange) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const newStock = Math.max(0, product.stock + quantityChange);
  const newStatus = getProductStatusFromStock(newStock);

  product.stock = newStock;
  product.status = newStatus;

  await product.save();
  return product;
};

/**
 * Determines product status based on stock level
 * @param {number} stock - Current stock quantity
 * @returns {string} Product status
 */
export const getProductStatusFromStock = (stock) => {
  if (stock === 0) return PRODUCT_STATUSES.OUT_OF_STOCK;
  if (stock <= LOW_STOCK_THRESHOLD) return PRODUCT_STATUSES.LOW_STOCK;
  return PRODUCT_STATUSES.ACTIVE;
};

/**
 * Syncs product status based on current stock
 * @param {Object} product - Product document
 * @returns {boolean} True if status was changed
 */
export const syncProductStatus = (product) => {
  const correctStatus = getProductStatusFromStock(product.stock);
  if (product.status !== correctStatus) {
    product.status = correctStatus;
    return true;
  }
  return false;
};

/**
 * Reserves stock for an order (reduces available stock)
 * @param {Array} items - Order items with product IDs and quantities
 * @returns {Promise<Array>} Array of updated products
 */
export const reserveProductStock = async (items) => {
  const updates = [];

  for (const item of items) {
    const updatedProduct = await updateProductStock(item.product, -item.quantity);
    updates.push(updatedProduct);
  }

  return updates;
};

/**
 * Restores stock when order is canceled or returned
 * @param {Array} items - Order items with product IDs and quantities
 * @returns {Promise<Array>} Array of updated products
 */
export const restoreProductStock = async (items) => {
  const updates = [];

  for (const item of items) {
    const updatedProduct = await updateProductStock(item.product, item.quantity);
    updates.push(updatedProduct);
  }

  return updates;
};

/**
 * Checks if products are available for the given quantities
 * @param {Array} items - Order items with product IDs and quantities
 * @returns {Promise<Object>} { available: boolean, unavailableProducts: Array }
 */
export const checkProductAvailability = async (items) => {
  const productIds = items.map(item => item.product);
  const products = await Product.find({ _id: { $in: productIds } });

  const unavailableProducts = [];

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.product);
    if (!product) {
      unavailableProducts.push({
        productId: item.product,
        reason: 'Product not found'
      });
    } else if (product.stock < item.quantity) {
      unavailableProducts.push({
        productId: item.product,
        productName: product.name,
        requested: item.quantity,
        available: product.stock,
        reason: 'Insufficient stock'
      });
    }
  }

  return {
    available: unavailableProducts.length === 0,
    unavailableProducts
  };
};