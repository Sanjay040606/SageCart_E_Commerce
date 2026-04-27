import { ORDER_STATUSES, getStatusTimestamp, hasCanceledFlow, hasReturnFlow, isPrepaidOrder } from "@/lib/orderLifecycle";
import { SUPPORT_ACTIONS, getShortOrderId } from "@/lib/supportCenter";
import { getPrimaryOrderProductLabel } from "@/lib/orderDisplay";

const STORAGE_KEY = "sagecart-support-queries";
export const SUPPORT_HISTORY_EVENT = "sagecart-support-history-updated";

const isBrowser = () => typeof window !== "undefined";

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const buildTimelineStep = (label, date, note = "") => ({
  label,
  date: date || null,
  note,
});

const buildSupportTimeline = (order, action) => {
  const steps = [];

  if (action === SUPPORT_ACTIONS.CANCEL) {
    const canceledAt = getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order?.canceledAt);
    const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order?.refundRequestedAt);
    const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order?.refundCompletedAt);

    steps.push(buildTimelineStep("Canceled", canceledAt, "The order was canceled before shipment."));

    if (isPrepaidOrder(order)) {
      steps.push(buildTimelineStep("Refund initiated", refundInitiatedAt, "The refund is being processed."));
      steps.push(buildTimelineStep("Refund completed", refundedAt, "The refund reached the payment source."));
    }
  }

  if (action === SUPPORT_ACTIONS.RETURN) {
    const returnConfirmedAt = getStatusTimestamp(order, ORDER_STATUSES.RETURN_CONFIRMED, order?.returnRequestedAt);
    const outForPickupAt = getStatusTimestamp(order, ORDER_STATUSES.OUT_FOR_PICKUP);
    const returnedAt = getStatusTimestamp(order, ORDER_STATUSES.RETURNED);
    const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order?.refundRequestedAt);
    const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order?.refundCompletedAt);

    steps.push(buildTimelineStep("Return confirmed", returnConfirmedAt, "The return request has been saved."));
    steps.push(buildTimelineStep("Out for pickup", outForPickupAt, "Pickup has been scheduled."));
    steps.push(buildTimelineStep("Returned", returnedAt, "The item has been collected and marked returned."));

    if (isPrepaidOrder(order)) {
      steps.push(buildTimelineStep("Refund initiated", refundInitiatedAt, "The refund will start after the return is received."));
      steps.push(buildTimelineStep("Refund completed", refundedAt, "The payment refund has been completed."));
    }
  }

  if (action === SUPPORT_ACTIONS.REFUND) {
    const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order?.refundRequestedAt);
    const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order?.refundCompletedAt);

    steps.push(buildTimelineStep("Refund initiated", refundInitiatedAt, "Refund processing has started."));
    steps.push(buildTimelineStep("Refund completed", refundedAt, "Refund processing has finished."));
  }

  return steps;
};

const emitSupportHistoryEvent = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(SUPPORT_HISTORY_EVENT));
};

export const loadSupportHistory = () => {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  const parsed = safeParse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

export const saveSupportHistory = (entries) => {
  if (!isBrowser()) return entries;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  emitSupportHistoryEvent();
  return entries;
};

export const createSupportHistoryItem = ({ action, order, status = "open", note = "" }) => {
  const timestamp = new Date().toISOString();
  const ticketStatus = status || "open";

  return {
    id: `${action}:${order._id}`,
    action,
    orderId: order._id,
    orderShortId: getShortOrderId(order._id),
    productName: getPrimaryOrderProductLabel(order),
    orderStatus: order.status || ORDER_STATUSES.CONFIRMED,
    paymentState: isPrepaidOrder(order) ? "Paid" : "COD",
    title: `${action === SUPPORT_ACTIONS.CANCEL ? "Cancellation" : "Return"} request`,
    summary: note,
    timeline: buildSupportTimeline(order, action),
    status: ticketStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
    resolvedAt: ticketStatus === "resolved" ? timestamp : null,
  };
};

export const upsertSupportHistoryItem = (item) => {
  if (!item?.id) return [];

  const current = loadSupportHistory();
  const next = [...current];
  const index = next.findIndex((entry) => entry.id === item.id);
  const now = new Date().toISOString();

  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...item,
      updatedAt: now,
      resolvedAt: item.status === "resolved" ? item.resolvedAt || now : next[index].resolvedAt || null,
    };
  } else {
    next.unshift({
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
      resolvedAt: item.status === "resolved" ? item.resolvedAt || now : null,
    });
  }

  return saveSupportHistory(next);
};

const resolveCancelState = (item, order) => {
  if (!hasCanceledFlow(order)) {
    return { status: "open" };
  }

  if (isPrepaidOrder(order) && order.status !== ORDER_STATUSES.REFUNDED) {
    return { status: "in-progress", orderStatus: order.status || item.orderStatus };
  }

  return {
    status: "resolved",
    resolvedAt: order.refundCompletedAt ? new Date(order.refundCompletedAt).toISOString() : new Date().toISOString(),
    orderStatus: order.status || item.orderStatus,
  };
};

const resolveReturnState = (item, order) => {
  if (!hasReturnFlow(order)) {
    return { status: "open" };
  }

  const returnResolved = order.status === ORDER_STATUSES.REFUNDED
    || (order.status === ORDER_STATUSES.RETURNED && !isPrepaidOrder(order));

  if (!returnResolved) {
    return { status: "in-progress", orderStatus: order.status || item.orderStatus };
  }

  return {
    status: "resolved",
    resolvedAt: order.refundCompletedAt
      ? new Date(order.refundCompletedAt).toISOString()
      : getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order.refundCompletedAt)
        || getStatusTimestamp(order, ORDER_STATUSES.RETURNED)
        || new Date().toISOString(),
    orderStatus: order.status || item.orderStatus,
  };
};

export const resolveSupportHistoryFromOrders = (orders = []) => {
  if (!isBrowser()) return [];

  const current = loadSupportHistory();
  if (!current.length) return current;

  let changed = false;
  const next = current.map((item) => {
    const order = orders.find((entry) => entry._id === item.orderId);
    if (!order) return item;

    const timeline = buildSupportTimeline(order, item.action);
    let nextItem = {
      ...item,
      orderStatus: order.status || item.orderStatus,
      timeline,
      updatedAt: new Date().toISOString(),
    };

    if (item.action === SUPPORT_ACTIONS.CANCEL) {
      nextItem = { ...nextItem, ...resolveCancelState(item, order) };
    } else if (item.action === SUPPORT_ACTIONS.RETURN) {
      nextItem = { ...nextItem, ...resolveReturnState(item, order) };
    }

    if (
      nextItem.status !== item.status
      || nextItem.orderStatus !== item.orderStatus
      || nextItem.resolvedAt !== item.resolvedAt
      || JSON.stringify(nextItem.timeline || []) !== JSON.stringify(item.timeline || [])
    ) {
      changed = true;
    }

    return nextItem;
  });

  if (changed) {
    saveSupportHistory(next);
  }

  return next;
};

export const removeResolvedSupportHistory = () => {
  const current = loadSupportHistory();
  const next = current.filter((item) => item.status !== "resolved");
  return saveSupportHistory(next);
};
