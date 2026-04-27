import {
  ORDER_STATUSES,
  REFUND_DELAY_HOURS,
  canCancelOrder,
  canRequestReturn,
  getOrderMilestones,
  hasCanceledFlow,
  hasReturnFlow,
  isPrepaidOrder
} from "@/lib/orderLifecycle";
import { getPrimaryOrderProductLabel } from "@/lib/orderDisplay";

export const SUPPORT_ACTIONS = {
  TRACK: "track",
  REFUND: "refund",
  CANCEL: "cancel",
  RETURN: "return",
};

export const SUPPORT_ACTION_LABELS = {
  [SUPPORT_ACTIONS.TRACK]: "Track order",
  [SUPPORT_ACTIONS.REFUND]: "Refund status",
  [SUPPORT_ACTIONS.CANCEL]: "Cancel order",
  [SUPPORT_ACTIONS.RETURN]: "Return order",
};

export const SUPPORT_ACTION_DESCRIPTIONS = {
  [SUPPORT_ACTIONS.TRACK]: "See the current order stage and delivery timing.",
  [SUPPORT_ACTIONS.REFUND]: "Check refund progress for canceled or returned orders.",
  [SUPPORT_ACTIONS.CANCEL]: "Review orders that can still be canceled before shipment.",
  [SUPPORT_ACTIONS.RETURN]: "Review delivered orders that are still inside the return window.",
};

export const getShortOrderId = (orderId) => {
  if (!orderId) return "#------";

  const normalized = String(orderId).replace(/[^a-zA-Z0-9]/g, "");
  return `#${normalized.slice(-6)}`;
};

export const getOrderSupportTitle = (order) => {
  const productName = getPrimaryOrderProductLabel(order);
  return `${productName} - ${getShortOrderId(order?._id)}`;
};

export const getOrderSupportSubtitle = (order) => {
  const status = order?.status || ORDER_STATUSES.CONFIRMED;
  const paymentState = isPrepaidOrder(order) ? "Paid" : "COD";
  return `${status} - ${paymentState}`;
};

export const getOrderSupportButtonLabel = (order) => {
  return `${getOrderSupportTitle(order)} - ${order?.status || ORDER_STATUSES.CONFIRMED}`;
};

export const getEligibleSupportOrders = (orders = [], action) => {
  switch (action) {
    case SUPPORT_ACTIONS.TRACK:
      return orders.filter((order) => (
        !order?.deliveredAt
        && !hasCanceledFlow(order)
        && !hasReturnFlow(order)
      ));
    case SUPPORT_ACTIONS.CANCEL:
      return orders.filter((order) => canCancelOrder(order));
    case SUPPORT_ACTIONS.RETURN:
      return orders.filter((order) => canRequestReturn(order));
    case SUPPORT_ACTIONS.REFUND:
      return orders.filter((order) => (
        hasCanceledFlow(order)
        || hasReturnFlow(order)
        || order?.status === ORDER_STATUSES.REFUNDED
      ));
    default:
      return [];
  }
};

export const getSupportActionSummary = (order, action) => {
  const shortId = getShortOrderId(order?._id);
  const productName = getPrimaryOrderProductLabel(order);
  const { shippedEta, deliveryEta, returnDeadline } = getOrderMilestones(order || {});

  if (action === SUPPORT_ACTIONS.TRACK) {
    if (order?.status === ORDER_STATUSES.DELIVERED) {
      return `${productName} ${shortId} was already delivered on ${deliveryEta.toLocaleDateString("en-GB")}.`;
    }

    if (order?.status === ORDER_STATUSES.SHIPPED) {
      return `${productName} ${shortId} is shipped. Delivery ETA: ${deliveryEta.toLocaleDateString("en-GB")}.`;
    }

    if (order?.status === ORDER_STATUSES.OUT_FOR_DELIVERY) {
      return `${productName} ${shortId} is out for delivery today.`;
    }

    return `${productName} ${shortId} is waiting for shipment. Shipment ETA: ${shippedEta.toLocaleDateString("en-GB")}.`;
  }

  if (action === SUPPORT_ACTIONS.CANCEL) {
    if (canCancelOrder(order)) {
      return `${productName} ${shortId} can still be canceled before shipment starts.`;
    }

    if (hasCanceledFlow(order)) {
      return `${productName} ${shortId} is already canceled.`;
    }

    return `${productName} ${shortId} cannot be canceled because shipment has already started.`;
  }

  if (action === SUPPORT_ACTIONS.RETURN) {
    if (canRequestReturn(order)) {
      return `${productName} ${shortId} can be returned until ${returnDeadline.toLocaleDateString("en-GB")}.`;
    }

    if (hasReturnFlow(order)) {
      return `${productName} ${shortId} is already in the return flow.`;
    }

    return `${productName} ${shortId} is not inside the 7-day return window yet.`;
  }

  if (action === SUPPORT_ACTIONS.REFUND) {
    if (order?.status === ORDER_STATUSES.REFUNDED) {
      return `${productName} ${shortId} refund was completed already.`;
    }

    if (order?.status === ORDER_STATUSES.REFUND_INITIATED) {
      return `${productName} ${shortId} refund is in progress and should complete soon.`;
    }

    if (hasCanceledFlow(order) && isPrepaidOrder(order)) {
      return `${productName} ${shortId} refund is being processed.`;
    }

    if (hasReturnFlow(order)) {
      return `${productName} ${shortId} refund is linked to the return flow.`;
    }
  }

  return `${productName} ${shortId} is available for support.`;
};

export const getActionUnavailableReason = (action) => {
  switch (action) {
    case SUPPORT_ACTIONS.TRACK:
      return "No active shipments are available right now.";
    case SUPPORT_ACTIONS.CANCEL:
      return "No orders can be canceled at the moment.";
    case SUPPORT_ACTIONS.RETURN:
      return "No delivered orders are currently inside the return window.";
    case SUPPORT_ACTIONS.REFUND:
      return "No orders currently show refund progress.";
    default:
      return "No matching orders were found.";
  }
};

export const getSupportActionStatus = (order, action) => {
  if (action === SUPPORT_ACTIONS.CANCEL) {
    if (hasCanceledFlow(order)) {
      return isPrepaidOrder(order) && order?.status !== ORDER_STATUSES.REFUNDED
        ? "in-progress"
        : "resolved";
    }

    return canCancelOrder(order) ? "open" : "resolved";
  }

  if (action === SUPPORT_ACTIONS.RETURN) {
    if (hasReturnFlow(order)) {
      return order?.status === ORDER_STATUSES.REFUNDED ? "resolved" : "in-progress";
    }

    return canRequestReturn(order) ? "open" : "resolved";
  }

  if (action === SUPPORT_ACTIONS.REFUND) {
    return order?.status === ORDER_STATUSES.REFUNDED ? "resolved" : "in-progress";
  }

  return "open";
};

export const getRefundSummaryText = (order) => {
  const shortId = getShortOrderId(order?._id);
  const productName = getPrimaryOrderProductLabel(order);
  const refundRequestedAt = order?.refundRequestedAt ? new Date(order.refundRequestedAt) : null;
  const refundCompletedAt = order?.refundCompletedAt ? new Date(order.refundCompletedAt) : null;

  if (order?.status === ORDER_STATUSES.REFUNDED && refundCompletedAt) {
    return `${productName} ${shortId} refund was completed on ${refundCompletedAt.toLocaleDateString("en-GB")}.`;
  }

  if (order?.status === ORDER_STATUSES.REFUND_INITIATED && refundRequestedAt) {
    return `${productName} ${shortId} refund was initiated on ${refundRequestedAt.toLocaleDateString("en-GB")} and should complete in about ${REFUND_DELAY_HOURS} hours.`;
  }

  if (hasCanceledFlow(order) && isPrepaidOrder(order)) {
    return `${productName} ${shortId} is waiting on the automatic refund step.`;
  }

  if (hasReturnFlow(order)) {
    return `${productName} ${shortId} refund is linked to the return flow.`;
  }

  return `${productName} ${shortId} does not have an active refund right now.`;
};
