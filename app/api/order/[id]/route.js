import { auth } from "@clerk/nextjs/server";
import connectDB from "@/config/db";
import Order from "@/models/Order";
import { sendOrderLifecycleEmailsIfNeeded } from "@/lib/emailNotifications";
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

    const order = await Order.findById(params.id)
      .populate("userId", "name email")
      .populate("items.product", "name image price offerPrice")
      .populate("address", "fullName area city state phoneNumber");

    if (!order) {
      return Response.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    // Check if order belongs to the authenticated user
    if (order.userId._id.toString() !== userId) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    const { changed } = syncOrderWithSystemTime(order);
    if (changed) {
      await order.save();
    }
    void sendOrderLifecycleEmailsIfNeeded(order).catch((emailError) => {
      console.error("Failed to send order lifecycle email:", emailError);
    });

    return Response.json({ success: true, order }, { status: 200 });
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
          const baseTime = now.getTime();
          order.refundRequestedAt = new Date(baseTime);
          order.refundCompletedAt = new Date(baseTime + (3 * 60 * 60 * 1000));
          addTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED, new Date(baseTime), 'Return confirmed. Pickup has been scheduled.');
          addTimelineEntry(order, ORDER_STATUSES.OUT_FOR_PICKUP, new Date(baseTime + (60 * 60 * 1000)), 'Pickup agent is out for pickup today.');
          addTimelineEntry(order, ORDER_STATUSES.RETURNED, new Date(baseTime + (2 * 60 * 60 * 1000)), 'Returned item has been received successfully.');
          addTimelineEntry(order, ORDER_STATUSES.REFUNDED, new Date(baseTime + (3 * 60 * 60 * 1000)), 'Refund completed successfully after return.');
          order.status = ORDER_STATUSES.REFUNDED;

          // Note: Stock will be restored when the return is actually completed (RETURNED status)
          // This happens automatically in the syncOrderWithSystemTime function
        } else {
          return Response.json({ success: false, message: 'Return is available only within 7 days after delivery.' }, { status: 400 });
        }
        break;
      case 'complete-return':
        if (getTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED)) {
          order.status = ORDER_STATUSES.REFUNDED;
        } else {
          return Response.json({ success: false, message: 'Order is not in return request stage.' }, { status: 400 });
        }
        break;
      default:
        return Response.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    await order.save();

    const emailReadyOrder = await Order.findById(order._id)
      .populate("userId", "name email")
      .populate("items.product", "name image price offerPrice")
      .populate("address", "fullName area city state phoneNumber");

    void sendOrderLifecycleEmailsIfNeeded(emailReadyOrder || order).catch((emailError) => {
      console.error("Failed to send order lifecycle email:", emailError);
    });
    return Response.json({ success: true, order }, { status: 200 });
  } catch (error) {
    console.log(error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
};
