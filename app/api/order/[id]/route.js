import { auth } from "@clerk/nextjs/server";
import connectDB from "@/config/db";
import Order from "@/models/Order";
import User from "@/models/User";
import { sendOrderLifecycleEmailsIfNeeded } from "@/lib/emailNotifications";
import { hydrateOrderDocument } from "@/lib/orderHydration";
import {
  ORDER_STATUSES,
  addTimelineEntry,
  canCancelOrder,
  canRequestReturn,
  getTimelineEntry,
  isPrepaidOrder,
  syncOrderWithSystemTime
} from "@/lib/orderLifecycle";
import { restoreProductStock } from "@/lib/productStock";

export const GET = async (req, { params }) => {
  try {
    await connectDB();
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await Order.findById(params.id);

    if (!order) {
      return Response.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    // Check if order belongs to the authenticated user
    if (String(order.userId) !== userId) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { changed } = syncOrderWithSystemTime(order);
    if (changed) {
      await order.save();
    }

    try {
      const user = await User.findById(order.userId).select("name email").lean();
      await sendOrderLifecycleEmailsIfNeeded(order, { user });
    } catch (emailError) {
      console.error("Failed to send order lifecycle email:", emailError);
    }

    const hydratedOrder = await hydrateOrderDocument(order, {
      productSelect: "name image price offerPrice reviews"
    });

    return Response.json({ success: true, order: hydratedOrder }, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
};

export const PATCH = async (req, { params }) => {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();
    const order = await Order.findById(params.id);
    if (!order) {
      return Response.json({ success: false, message: 'Order not found' }, { status: 404 });
    }
    if (order.userId.toString() !== userId) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();

    syncOrderWithSystemTime(order, now);

    // Handle stock restoration for completed returns
    if (order.needsStockRestoration) {
      try {
        await restoreProductStock(order.items);
        order.stockRestored = true;
        order.needsStockRestoration = false;
      } catch (stockError) {
        console.error('Failed to restore product stock on return completion:', stockError);
      }
    }

    switch (action) {
      case 'sync-status':
        // Status sync is already handled above by syncOrderWithSystemTime
        break;
      case 'cancel':
        if (canCancelOrder(order, now)) {
          order.status = ORDER_STATUSES.CANCELED;
          order.canceledAt = now;
          addTimelineEntry(order, ORDER_STATUSES.CANCELED, now, 'Order canceled before shipment.');

          // Restore product stock when order is canceled
          try {
            await restoreProductStock(order.items);
          } catch (stockError) {
            console.error('Failed to restore product stock on cancel:', stockError);
          }

          if (isPrepaidOrder(order)) {
            order.refundRequestedAt = now;
            addTimelineEntry(order, ORDER_STATUSES.REFUND_INITIATED, now, 'Refund has been initiated automatically.');
            order.status = ORDER_STATUSES.REFUND_INITIATED;
          }
        } else {
          return Response.json({ success: false, message: 'Cannot cancel after shipment.' }, { status: 400 });
        }
        break;
      case 'complete-refund':
        if ((order.status === ORDER_STATUSES.CANCELED || order.status === ORDER_STATUSES.REFUND_INITIATED) && isPrepaidOrder(order)) {
          order.status = ORDER_STATUSES.REFUNDED;
          order.refundCompletedAt = now;
          addTimelineEntry(order, ORDER_STATUSES.REFUNDED, now, `Refund completed successfully to ${order.paymentMethod}.`);
        } else {
          return Response.json({ success: false, message: 'Cannot process refund for this order.' }, { status: 400 });
        }
        break;
      case 'ship':
        if (order.status === ORDER_STATUSES.CONFIRMED) {
          order.status = ORDER_STATUSES.SHIPPED;
          if (!order.shippedAt) {
            order.shippedAt = now;
          }
          addTimelineEntry(order, ORDER_STATUSES.SHIPPED, order.shippedAt, 'Your order has been shipped.');
        } else {
          return Response.json({ success: false, message: 'Order cannot be shipped at this stage.' }, { status: 400 });
        }
        break;
      case 'request-return':
        if (canRequestReturn(order, now)) {
          order.returnRequestedAt = now;
          order.refundRequestedAt = null;
          order.refundCompletedAt = null;
          order.needsStockRestoration = false;
          addTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED, now, 'Return confirmed. Pickup has been scheduled for tomorrow and the return will complete the same day.');
          order.status = ORDER_STATUSES.RETURN_CONFIRMED;

          // Note: Stock will be restored when the return is actually completed (RETURNED status)
          // This happens automatically in the syncOrderWithSystemTime function
        } else {
          return Response.json({ success: false, message: 'Return is available only within 7 days after delivery.' }, { status: 400 });
        }
        break;
      case 'complete-return':
        if (getTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED) || getTimelineEntry(order, ORDER_STATUSES.OUT_FOR_PICKUP)) {
          addTimelineEntry(order, ORDER_STATUSES.RETURNED, now, 'Item picked up and returned successfully.');
          order.status = ORDER_STATUSES.RETURNED;

          if (isPrepaidOrder(order) && !order.refundRequestedAt) {
            order.refundRequestedAt = now;
            addTimelineEntry(order, ORDER_STATUSES.REFUND_INITIATED, now, 'Refund initiated for your return.');
          }

          try {
            await restoreProductStock(order.items);
            order.stockRestored = true;
            order.needsStockRestoration = false;
          } catch (stockError) {
            console.error('Failed to restore product stock on manual return completion:', stockError);
          }
        } else {
          return Response.json({ success: false, message: 'Order is not in return request stage.' }, { status: 400 });
        }
        break;
      default:
        return Response.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    await order.save();

    try {
      await sendOrderLifecycleEmailsIfNeeded(order);
    } catch (emailError) {
      console.error("Failed to send order lifecycle email:", emailError);
    }
    return Response.json({ success: true, order }, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
};
