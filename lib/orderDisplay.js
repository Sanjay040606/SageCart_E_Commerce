import {
  ORDER_STATUSES,
  hasCanceledFlow,
  hasReturnFlow,
  isPrepaidOrder
} from "@/lib/orderLifecycle";

export const getPrimaryOrderProductLabel = (order) => {
  const primaryName = order?.items?.[0]?.product?.name || order?.items?.[0]?.productName || "Product";
  const extraCount = Math.max((order?.items?.length || 0) - 1, 0);

  if (extraCount > 0) {
    return `${primaryName} +${extraCount} more`;
  }

  return primaryName;
};

export const getOrderSummaryStatusLabel = (order) => {
  if (hasCanceledFlow(order) && isPrepaidOrder(order) && order.status === ORDER_STATUSES.REFUNDED) {
    return "Canceled and Refunded";
  }

  if (hasCanceledFlow(order) && isPrepaidOrder(order)) {
    return "Refund Initiated";
  }

  if (hasCanceledFlow(order)) {
    return "Order Canceled";
  }

  if (hasReturnFlow(order) && order.status === ORDER_STATUSES.REFUNDED) {
    return "Return Refunded";
  }

  if (order?.status === ORDER_STATUSES.RETURNED) {
    return "Returned";
  }

  return order?.status || ORDER_STATUSES.CONFIRMED;
};

export const getOrderSummaryStatusClass = (order) => {
  const status = getOrderSummaryStatusLabel(order);

  if (status === "Canceled and Refunded" || status === "Refunded" || status === "Return Refunded") {
    return "text-green-600";
  }

  if (status === "Refund Initiated") {
    return "text-amber-600";
  }

  if (status === "Order Canceled" || status === "Canceled") {
    return "text-red-600";
  }

  return "text-gray-700";
};

export const getOrderPaymentStateLabel = (order) => {
  if (hasCanceledFlow(order)) {
    return isPrepaidOrder(order)
      ? (order.status === ORDER_STATUSES.REFUNDED ? "Refunded" : "Refund processing")
      : "Order canceled";
  }

  if (hasReturnFlow(order)) {
    return isPrepaidOrder(order)
      ? (order.status === ORDER_STATUSES.REFUNDED ? "Refunded" : "Refund processing")
      : "Paid";
  }

  if (isPrepaidOrder(order)) return "Paid";
  if (order?.status === ORDER_STATUSES.DELIVERED || order?.deliveredAt) return "Paid";
  return "Pending";
};

export const getOrderPaymentStateClass = (order) => {
  const state = getOrderPaymentStateLabel(order);

  if (state === "Paid" || state === "Refunded") {
    return "text-green-600 font-medium";
  }

  if (state === "Refund processing") {
    return "text-amber-600 font-medium";
  }

  if (state === "Order canceled") {
    return "text-red-600 font-medium";
  }

  return "text-gray-600";
};
