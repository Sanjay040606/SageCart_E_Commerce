import User from "@/models/User";
import { buildCanceledEmail, buildDeliveredEmail, buildOrderPlacedEmail, buildRefundEmail, buildWelcomeEmail } from "@/lib/emailTemplates";
import { sendEmail } from "@/lib/mailer";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import { ORDER_STATUSES } from "@/lib/orderLifecycle";

const formatDate = (value) => new Date(value).toLocaleDateString("en-GB");

const orderItemsForEmail = (order) =>
  (order.items || []).map((item) => ({
    name: item.product?.name || item.productName || "Product",
    quantity: item.quantity,
    price: formatPrice(
      item.offerPriceInr ||
      (item.lineTotalInr && item.quantity ? Math.round(item.lineTotalInr / item.quantity) : 0) ||
      (item.product?.offerPrice != null ? convertUSDToINR(item.product.offerPrice) : 0),
      "Rs. "
    ),
  }));

export const sendWelcomeEmailIfNeeded = async (user) => {
  if (!user?.email || user.welcomeEmailSentAt) return false;

  const email = buildWelcomeEmail({ name: user.name || "there" });
  await sendEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
  });

  user.welcomeEmailSentAt = new Date();
  await user.save();
  return true;
};

export const sendOrderPlacedEmailIfNeeded = async ({ order, user }) => {
  if (!order || !user?.email || order.orderEmailSentAt) return false;

  const email = buildOrderPlacedEmail({
    userName: user.name || "there",
    orderId: order._id.toString(),
    items: orderItemsForEmail(order),
    totalAmount: formatPrice(order.amountInr || 0, "Rs. "),
    deliveryDate: formatDate(order.estimatedDeliveryDate || order.date),
    paymentMethod: order.paymentMethod || "COD",
    shippingAmount: order.shippingInr === 0 ? "Free" : formatPrice(order.shippingInr || 0, "Rs. "),
    discountAmount: formatPrice(order.discountInr || 0, "Rs. "),
    addressText: [
      order.address?.fullName,
      order.address?.area,
      `${order.address?.city || ""}${order.address?.city && order.address?.state ? ", " : ""}${order.address?.state || ""}`,
      order.address?.phoneNumber
    ].filter(Boolean).join("<br/>"),
  });

  await sendEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
  });

  order.orderEmailSentAt = new Date();
  await order.save();
  return true;
};

export const sendOrderLifecycleEmailsIfNeeded = async (order) => {
  if (!order?.userId) return false;

  const user = typeof order.userId === "object" && order.userId.email
    ? order.userId
    : await User.findById(order.userId);

  if (!user?.email) return false;

  let sent = false;

  if (order.status === ORDER_STATUSES.CANCELED && order.canceledAt && !order.cancelEmailSentAt) {
    const email = buildCanceledEmail({
      userName: user.name || "there",
      orderId: order._id.toString(),
      canceledDate: formatDate(order.canceledAt),
      refundMessage: "This order used Cash on Delivery, so no refund is required. The cancellation has been completed successfully.",
      items: orderItemsForEmail(order),
      totalAmount: formatPrice(order.amountInr || 0, "Rs. "),
      paymentMethod: order.paymentMethod || "COD"
    });

    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    });

    order.cancelEmailSentAt = new Date();
    sent = true;
  }

  if (order.status === ORDER_STATUSES.REFUND_INITIATED && order.canceledAt && !order.cancelEmailSentAt) {
    const email = buildCanceledEmail({
      userName: user.name || "there",
      orderId: order._id.toString(),
      canceledDate: formatDate(order.canceledAt),
      refundMessage: "Your payment has been marked for refund. The refund will be completed automatically after a few hours and we will send a separate confirmation email once it is finished.",
      items: orderItemsForEmail(order),
      totalAmount: formatPrice(order.amountInr || 0, "Rs. "),
      paymentMethod: order.paymentMethod || "UPI"
    });

    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    });

    order.cancelEmailSentAt = new Date();
    sent = true;
  }

  if (order.status === ORDER_STATUSES.DELIVERED && order.deliveredAt && !order.deliveryEmailSentAt) {
    const email = buildDeliveredEmail({
      userName: user.name || "there",
      orderId: order._id.toString(),
      deliveredDate: formatDate(order.deliveredAt),
    });

    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    });

    order.deliveryEmailSentAt = new Date();
    sent = true;
  }

  if (order.status === ORDER_STATUSES.REFUNDED && order.refundCompletedAt && !order.refundEmailSentAt) {
    const email = buildRefundEmail({
      userName: user.name || "there",
      orderId: order._id.toString(),
      refundDate: formatDate(order.refundCompletedAt),
      totalAmount: formatPrice(order.amountInr || 0, "Rs. "),
      paymentMethod: order.paymentMethod || "UPI",
    });

    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    });

    order.refundEmailSentAt = new Date();
    sent = true;
  }

  if (sent) {
    await order.save();
  }

  return sent;
};
