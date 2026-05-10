import { ORDER_STATUSES, getStatusTimestamp, hasCanceledFlow, hasReturnFlow, isPrepaidOrder } from "@/lib/orderLifecycle";
import { SUPPORT_ACTIONS, getShortOrderId } from "@/lib/supportCenter";
import { getPrimaryOrderProductLabel } from "@/lib/orderDisplay";

const STORAGE_KEY = "sagecart-support-queries";
export const SUPPORT_HISTORY_EVENT = "sagecart-support-history-updated";
const SUPPORT_HISTORY_LIMIT = 25;

const isBrowser = () => typeof window !== "undefined";

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const getSupportHistoryTimestamp = (item = {}) => {
  const value = item?.updatedAt || item?.createdAt || null;
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

const normalizeSupportTimelineStep = (step = {}) => ({
  label: String(step?.label || ""),
  date: step?.date || null,
  note: String(step?.note || ""),
});

export const normalizeSupportHistoryItem = (item = {}) => ({
  id: String(item?.id || ""),
  action: String(item?.action || ""),
  orderId: String(item?.orderId || ""),
  orderShortId: String(item?.orderShortId || ""),
  productName: String(item?.productName || ""),
  orderStatus: String(item?.orderStatus || ""),
  paymentState: String(item?.paymentState || ""),
  title: String(item?.title || ""),
  summary: String(item?.summary || ""),
  timeline: Array.isArray(item?.timeline)
    ? item.timeline.map(normalizeSupportTimelineStep).filter((step) => step.label || step.date || step.note)
    : [],
  status: String(item?.status || "open"),
  createdAt: item?.createdAt || null,
  updatedAt: item?.updatedAt || null,
  resolvedAt: item?.resolvedAt || null,
});

export const normalizeSupportHistoryEntries = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .map(normalizeSupportHistoryItem)
    .filter((item) => Boolean(item.id))
    .sort((a, b) => getSupportHistoryTimestamp(b) - getSupportHistoryTimestamp(a))
    .slice(0, SUPPORT_HISTORY_LIMIT);

export const mergeSupportHistoryEntries = (primaryEntries = [], secondaryEntries = []) => {
  const merged = new Map();

  [...normalizeSupportHistoryEntries(primaryEntries), ...normalizeSupportHistoryEntries(secondaryEntries)].forEach((item) => {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      return;
    }

    merged.set(
      item.id,
      getSupportHistoryTimestamp(item) >= getSupportHistoryTimestamp(existing) ? item : existing
    );
  });

  return normalizeSupportHistoryEntries(Array.from(merged.values()));
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

export const loadSupportHistory = (fallbackEntries = []) => {
  if (!isBrowser()) return normalizeSupportHistoryEntries(fallbackEntries);

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return normalizeSupportHistoryEntries(fallbackEntries);

  const parsed = safeParse(raw);
  return mergeSupportHistoryEntries(parsed, fallbackEntries);
};

export const saveSupportHistory = (entries) => {
  const next = normalizeSupportHistoryEntries(entries);

  if (!isBrowser()) return next;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitSupportHistoryEvent();
  return next;
};

export const syncSupportHistoryToServer = async (token, entries = []) => {
  const next = normalizeSupportHistoryEntries(entries);

  if (!token || !isBrowser()) {
    return next;
  }

  try {
    const response = await fetch("/api/user/data", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ supportQueryHistory: next })
    });

    if (!response.ok) {
      return next;
    }

    const data = await response.json().catch(() => ({}));
    return normalizeSupportHistoryEntries(data?.user?.supportQueryHistory || next);
  } catch {
    return next;
  }
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

export const upsertSupportHistoryItem = (item, options = {}) => {
  if (!item?.id) return [];

  const current = loadSupportHistory(options.baseEntries || []);
  const next = [...current];
  const normalizedItem = normalizeSupportHistoryItem(item);
  const index = next.findIndex((entry) => entry.id === normalizedItem.id);
  const now = new Date().toISOString();

  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...normalizedItem,
      updatedAt: now,
      resolvedAt: normalizedItem.status === "resolved" ? normalizedItem.resolvedAt || now : next[index].resolvedAt || null,
    };
  } else {
    next.unshift({
      ...normalizedItem,
      createdAt: normalizedItem.createdAt || now,
      updatedAt: now,
      resolvedAt: normalizedItem.status === "resolved" ? normalizedItem.resolvedAt || now : null,
    });
  }

  const saved = saveSupportHistory(next);

  if (options.token) {
    void syncSupportHistoryToServer(options.token, saved);
  }

  return saved;
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

export const resolveSupportHistoryFromOrders = (orders = [], options = {}) => {
  const current = loadSupportHistory(options.baseEntries || []);
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
    const saved = saveSupportHistory(next);
    if (options.token) {
      void syncSupportHistoryToServer(options.token, saved);
    }
    return saved;
  }

  return next;
};

export const removeResolvedSupportHistory = (options = {}) => {
  const current = loadSupportHistory(options.baseEntries || []);
  const next = current.filter((item) => item.status !== "resolved");
  const saved = saveSupportHistory(next);
  if (options.token) {
    void syncSupportHistoryToServer(options.token, saved);
  }
  return saved;
};
