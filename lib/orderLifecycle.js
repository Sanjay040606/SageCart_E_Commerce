const DAY_IN_MS = 24 * 60 * 60 * 1000
const HOUR_IN_MS = 60 * 60 * 1000

export const ORDER_STATUSES = {
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled',
  REFUND_INITIATED: 'Refund Initiated',
  REFUNDED: 'Refunded',
  RETURN_CONFIRMED: 'Return Confirmed',
  OUT_FOR_PICKUP: 'Out for Pickup',
  RETURNED: 'Returned'
}

export const REFUND_DELAY_HOURS = 3

export const getOrderMilestones = (order) => {
  const placedAt = new Date(order?.date || Date.now())
  const shippedEta = new Date(placedAt.getTime() + DAY_IN_MS)
  const outForDeliveryEta = new Date(placedAt.getTime() + (3 * DAY_IN_MS))
  outForDeliveryEta.setHours(8, 0, 0, 0)
  const deliveryEta = new Date(placedAt.getTime() + (3 * DAY_IN_MS))
  deliveryEta.setHours(18, 0, 0, 0)
  const returnDeadline = new Date(deliveryEta.getTime() + (7 * DAY_IN_MS))

  return { placedAt, shippedEta, outForDeliveryEta, deliveryEta, returnDeadline }
}

export const getTimelineEntry = (order, status) => {
  if (!order?.statusTimeline?.length) return null
  return order.statusTimeline.find((entry) => entry.status === status) || null
}

export const hasTimelineEntry = (order, status) => Boolean(getTimelineEntry(order, status))

export const addTimelineEntry = (order, status, timestamp, message) => {
  if (!order.statusTimeline) {
    order.statusTimeline = []
  }

  if (hasTimelineEntry(order, status)) return false

  order.statusTimeline.push({
    status,
    timestamp,
    message
  })

  return true
}

export const isPrepaidOrder = (order) => ['UPI', 'CARD'].includes(order?.paymentMethod)

export const hasReturnFlow = (order) =>
  [
    ORDER_STATUSES.RETURN_CONFIRMED,
    ORDER_STATUSES.OUT_FOR_PICKUP,
    ORDER_STATUSES.RETURNED
  ].some((status) => hasTimelineEntry(order, status))

export const hasCanceledFlow = (order) => hasTimelineEntry(order, ORDER_STATUSES.CANCELED)

export const getStatusTimestamp = (order, status, fallbackField) => {
  const timelineEntry = getTimelineEntry(order, status)
  if (timelineEntry?.timestamp) return timelineEntry.timestamp
  return fallbackField || null
}

export const canCancelOrder = (order, now = new Date()) => {
  if (!order) return false
  if (hasCanceledFlow(order) || hasReturnFlow(order)) return false
  if (order.status === ORDER_STATUSES.DELIVERED) return false

  const { shippedEta } = getOrderMilestones(order)
  return now < shippedEta && !order.shippedAt
}

export const canRequestReturn = (order, now = new Date()) => {
  if (!order?.deliveredAt) return false
  if (hasReturnFlow(order) || hasCanceledFlow(order)) return false

  const deliveredAt = new Date(order.deliveredAt)
  const deadline = new Date(deliveredAt.getTime() + (7 * DAY_IN_MS))
  return now <= deadline
}

export const getReturnMilestones = (order) => {
  const returnConfirmedAt = getStatusTimestamp(order, ORDER_STATUSES.RETURN_CONFIRMED, order.returnRequestedAt);
  if (!returnConfirmedAt) return null;
  const returnStarted = new Date(returnConfirmedAt);
  
  const outForPickupEta = new Date(returnStarted.getTime() + DAY_IN_MS);
  outForPickupEta.setHours(8, 0, 0, 0);

  const returnedEta = new Date(returnStarted.getTime() + (2 * DAY_IN_MS));
  returnedEta.setHours(18, 0, 0, 0);

  return { returnStarted, outForPickupEta, returnedEta };
}

export const syncOrderWithSystemTime = (order, now = new Date()) => {
  if (!order) return { changed: false, order }

  let changed = false
  const { placedAt, shippedEta, outForDeliveryEta, deliveryEta, returnDeadline } = getOrderMilestones(order)

  if (!hasTimelineEntry(order, ORDER_STATUSES.CONFIRMED)) {
    changed = addTimelineEntry(order, ORDER_STATUSES.CONFIRMED, placedAt, 'Your order has been confirmed.') || changed
  }

  if (hasCanceledFlow(order)) {
    const canceledAt = getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order.canceledAt)
    if (canceledAt && !order.canceledAt) {
      order.canceledAt = canceledAt
      changed = true
    }

    if (isPrepaidOrder(order)) {
      const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order.refundRequestedAt)
      if (refundInitiatedAt && !order.refundRequestedAt) {
        order.refundRequestedAt = refundInitiatedAt
        changed = true
      }

      const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order.refundCompletedAt)
      if (refundedAt && !order.refundCompletedAt) {
        order.refundCompletedAt = refundedAt
        changed = true
      }

      if (order.refundRequestedAt && !hasTimelineEntry(order, ORDER_STATUSES.REFUNDED)) {
        const refundReadyAt = new Date(new Date(order.refundRequestedAt).getTime() + (REFUND_DELAY_HOURS * HOUR_IN_MS))
        if (now >= refundReadyAt) {
          order.refundCompletedAt = refundReadyAt
          order.status = ORDER_STATUSES.REFUNDED
          changed = addTimelineEntry(order, ORDER_STATUSES.REFUNDED, refundReadyAt, 'Refund completed successfully.') || changed
          changed = true
        } else if (order.status !== ORDER_STATUSES.REFUND_INITIATED) {
          order.status = ORDER_STATUSES.REFUND_INITIATED
          changed = true
        }
      }
    } else if (order.status !== ORDER_STATUSES.CANCELED) {
      order.status = ORDER_STATUSES.CANCELED
      changed = true
    }

    return { changed, order }
  }

  // Return Flow
  if (hasReturnFlow(order)) {
    const returnMilestones = getReturnMilestones(order);
    if (returnMilestones) {
       const { outForPickupEta, returnedEta } = returnMilestones;

       if (now >= outForPickupEta && !hasTimelineEntry(order, ORDER_STATUSES.OUT_FOR_PICKUP) && !hasTimelineEntry(order, ORDER_STATUSES.RETURNED)) {
         changed = addTimelineEntry(order, ORDER_STATUSES.OUT_FOR_PICKUP, outForPickupEta, 'Your return is out for pickup.') || changed
       }
       if (now >= returnedEta && !hasTimelineEntry(order, ORDER_STATUSES.RETURNED)) {
         changed = addTimelineEntry(order, ORDER_STATUSES.RETURNED, returnedEta, 'Item picked up and returned successfully.') || changed
         if (!order.stockRestored) {
           order.needsStockRestoration = true;
           changed = true;
         }
       }
    }

    if (hasTimelineEntry(order, ORDER_STATUSES.RETURNED)) {
       if (isPrepaidOrder(order)) {
         if (!order.refundRequestedAt && !hasTimelineEntry(order, ORDER_STATUSES.REFUND_INITIATED)) {
             const returnedTime = getStatusTimestamp(order, ORDER_STATUSES.RETURNED);
             order.refundRequestedAt = new Date(returnedTime);
             changed = addTimelineEntry(order, ORDER_STATUSES.REFUND_INITIATED, new Date(order.refundRequestedAt), 'Refund initiated for your return.') || changed;
         }
         if (order.refundRequestedAt && !hasTimelineEntry(order, ORDER_STATUSES.REFUNDED)) {
            const refundReadyAt = new Date(new Date(order.refundRequestedAt).getTime() + (REFUND_DELAY_HOURS * HOUR_IN_MS))
            if (now >= refundReadyAt) {
               order.refundCompletedAt = refundReadyAt
               order.status = ORDER_STATUSES.REFUNDED
               changed = addTimelineEntry(order, ORDER_STATUSES.REFUNDED, refundReadyAt, 'Refund completed successfully.') || changed
               changed = true
            } else if (order.status !== ORDER_STATUSES.REFUND_INITIATED) {
               order.status = ORDER_STATUSES.REFUND_INITIATED
               changed = true
            }
         }
       } else {
         if (order.status !== ORDER_STATUSES.RETURNED) {
            order.status = ORDER_STATUSES.RETURNED;
            changed = true;
         }
       }
    } else if (hasTimelineEntry(order, ORDER_STATUSES.OUT_FOR_PICKUP)) {
       if (order.status !== ORDER_STATUSES.OUT_FOR_PICKUP) {
           order.status = ORDER_STATUSES.OUT_FOR_PICKUP; 
           changed = true;
       }
    } else {
       if (order.status !== ORDER_STATUSES.RETURN_CONFIRMED) {
           order.status = ORDER_STATUSES.RETURN_CONFIRMED; 
           changed = true;
       }
    }

    return { changed, order }
  }

  if (order.status === ORDER_STATUSES.REFUNDED) return { changed, order };

  if (now >= shippedEta && !order.shippedAt) {
    order.shippedAt = shippedEta
    changed = true
  }

  if (order.shippedAt && !hasTimelineEntry(order, ORDER_STATUSES.SHIPPED)) {
    changed = addTimelineEntry(order, ORDER_STATUSES.SHIPPED, new Date(order.shippedAt), 'Your order has been shipped.') || changed
  }
  
  if (now >= outForDeliveryEta && !order.outForDeliveryAt) {
    order.outForDeliveryAt = outForDeliveryEta
    changed = true
  }

  if (order.outForDeliveryAt && !hasTimelineEntry(order, ORDER_STATUSES.OUT_FOR_DELIVERY)) {
    changed = addTimelineEntry(order, ORDER_STATUSES.OUT_FOR_DELIVERY, new Date(order.outForDeliveryAt), 'Your order is out for delivery today.') || changed
  }

  if (now >= deliveryEta && !order.deliveredAt) {
    order.deliveredAt = deliveryEta
    changed = true
  }

  if (order.deliveredAt && !hasTimelineEntry(order, ORDER_STATUSES.DELIVERED)) {
    changed = addTimelineEntry(order, ORDER_STATUSES.DELIVERED, new Date(order.deliveredAt), 'Your order was delivered successfully.') || changed
  }

  if (order.deliveredAt) {
    if (order.status !== ORDER_STATUSES.DELIVERED) {
      order.status = ORDER_STATUSES.DELIVERED
      changed = true
    }
  } else if (order.outForDeliveryAt) {
    if (order.status !== ORDER_STATUSES.OUT_FOR_DELIVERY) {
      order.status = ORDER_STATUSES.OUT_FOR_DELIVERY
      changed = true
    }
  } else if (order.shippedAt) {
    if (order.status !== ORDER_STATUSES.SHIPPED) {
      order.status = ORDER_STATUSES.SHIPPED
      changed = true
    }
  } else {
    if (order.status !== ORDER_STATUSES.CONFIRMED) {
      order.status = ORDER_STATUSES.CONFIRMED
      changed = true
    }
  }

  if (!order.estimatedDeliveryDate || new Date(order.estimatedDeliveryDate).getTime() !== deliveryEta.getTime()) {
    order.estimatedDeliveryDate = deliveryEta
    changed = true
  }
  order.returnDeadline = returnDeadline

  return { changed, order }
}
