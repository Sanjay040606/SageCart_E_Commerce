import Address from "@/models/Address";
import Product from "@/models/Product";
import User from "@/models/User";
import { resolveOrderProductId, resolveOrderReferenceId } from "@/lib/orderUtils";
import { getProductVariantImage } from "@/lib/productDisplay";

const toPlainObject = (value) => {
  if (!value) return null;

  if (typeof value.toObject === "function") {
    return value.toObject({ getters: false, virtuals: false });
  }

  return { ...value };
};

const resolveProductSelect = (select) => select || "name image price offerPrice reviews";

const hydrateItemsWithProductMap = (items = [], productMap = new Map()) =>
  (Array.isArray(items) ? items.map(toPlainObject).filter(Boolean) : []).map((item) => {
    const productId = resolveOrderProductId(item);
    const product = productId ? productMap.get(productId) || null : null;

    return {
      ...item,
      productId: item.productId || productId || "",
      product: product || item.product || null,
      productName: item.productName || product?.name || "",
      productImage: item.productImage || getProductVariantImage(product, item) || (Array.isArray(product?.image) ? product.image[0] || "" : "")
    };
  });

export const hydrateOrderItems = async (items = [], productSelect) => {
  const plainItems = Array.isArray(items) ? items.map(toPlainObject).filter(Boolean) : [];
  const productIds = Array.from(new Set(plainItems.map(resolveOrderProductId).filter(Boolean)));
  const selectedFields = resolveProductSelect(productSelect);

  const productDocs = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select(selectedFields).lean()
    : [];

  const productMap = new Map(productDocs.map((product) => [String(product._id), product]));

  return hydrateItemsWithProductMap(plainItems, productMap);
};

export const hydrateOrderSummaries = async (orders = [], productSelect) => {
  const plainOrders = Array.isArray(orders) ? orders.map(toPlainObject).filter(Boolean) : [];
  const productIds = Array.from(
    new Set(
      plainOrders.flatMap((order) =>
        (Array.isArray(order.items) ? order.items : [])
          .map(resolveOrderProductId)
          .filter(Boolean)
      )
    )
  );
  const selectedFields = resolveProductSelect(productSelect);

  const productDocs = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select(selectedFields).lean()
    : [];

  const productMap = new Map(productDocs.map((product) => [String(product._id), product]));

  return plainOrders.map((order) => ({
    ...order,
    items: hydrateItemsWithProductMap(order.items, productMap)
  }));
};

export const hydrateOrderDocument = async (orderDoc, options = {}) => {
  if (!orderDoc) return null;

  const {
    userSelect = "name email",
    addressSelect = "fullName area city state phoneNumber",
    productSelect
  } = options;

  const order = toPlainObject(orderDoc);
  const userId = resolveOrderReferenceId(order.userId);
  const addressId = resolveOrderReferenceId(order.address);

  const [user, address, items] = await Promise.all([
    userId ? User.findById(userId).select(userSelect).lean() : null,
    addressId ? Address.findById(addressId).select(addressSelect).lean() : null,
    hydrateOrderItems(order.items, productSelect)
  ]);

  return {
    ...order,
    userId: user || order.userId,
    address: address || order.address,
    items
  };
};
