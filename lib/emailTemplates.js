const baseTemplate = ({ title, preview, body, footer = "SageCart Team" }) => `
  <div style="font-family: Arial, sans-serif; background:#f6f2ea; padding:24px; color:#314032;">
    <div style="max-width:680px; margin:0 auto; background:#fffdf8; border:1px solid #d8d3c7; border-radius:24px; overflow:hidden;">
      <div style="padding:24px 28px; background:linear-gradient(135deg,#f8f4ec 0%,#e8eee3 100%); border-bottom:1px solid #d8d3c7;">
        <div style="font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:#6f8167; margin-bottom:10px;">SageCart</div>
        <h1 style="margin:0; font-size:28px; color:#273127;">${title}</h1>
        <p style="margin:10px 0 0; color:#657161;">${preview}</p>
      </div>
      <div style="padding:28px;">
        ${body}
      </div>
      <div style="padding:18px 28px; border-top:1px solid #d8d3c7; color:#7f897a; font-size:13px;">
        ${footer}
      </div>
    </div>
  </div>
`;

const listItems = (items) => `
  <table style="width:100%; border-collapse:collapse; margin-top:18px;">
    <thead>
      <tr>
        <th style="text-align:left; padding:10px 0; border-bottom:1px solid #d8d3c7;">Product</th>
        <th style="text-align:left; padding:10px 0; border-bottom:1px solid #d8d3c7;">Qty</th>
        <th style="text-align:left; padding:10px 0; border-bottom:1px solid #d8d3c7;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => `
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #eee7db;">${item.name}</td>
          <td style="padding:10px 0; border-bottom:1px solid #eee7db;">${item.quantity}</td>
          <td style="padding:10px 0; border-bottom:1px solid #eee7db;">${item.price || "-"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
`;

export const buildWelcomeEmail = ({ name }) => ({
  subject: "Welcome to SageCart",
  html: baseTemplate({
    title: `Welcome, ${name}`,
    preview: "Your SageCart account is ready.",
    body: `
      <p style="margin-top:0;">Thanks for joining SageCart.</p>
      <p>We built this storefront to feel calmer, clearer, and easier to trust from browsing to delivery.</p>
      <p>You can now explore products, place orders, track delivery updates, and manage returns from your account.</p>
    `,
  }),
});

export const buildContactEmail = ({ name, email, phone, subject, message }) => ({
  subject: `[SageCart Contact] ${subject || "New message from website"}`,
  html: baseTemplate({
    title: "New Contact Message",
    preview: "A customer sent a message from the contact form.",
    body: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
      <p><strong>Subject:</strong> ${subject || "General inquiry"}</p>
      <p><strong>Message:</strong></p>
      <div style="padding:16px; background:#f8f4ec; border-radius:16px; border:1px solid #d8d3c7;">${message}</div>
    `,
    footer: "Reply directly to this email to respond to the customer.",
  }),
  text: `${name}\n${email}\n${phone || ""}\n\n${message}`,
});

export const buildOrderPlacedEmail = ({ userName, orderId, items, totalAmount, deliveryDate, paymentMethod, shippingAmount, discountAmount, addressText }) => ({
  subject: `Your SageCart order ${orderId} is confirmed`,
  html: baseTemplate({
    title: "Order Confirmed",
    preview: `Order ${orderId} has been placed successfully.`,
    body: `
      <p>Hi ${userName},</p>
      <p>Your order has been placed successfully. Below is your invoice summary.</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Payment Method:</strong> ${paymentMethod}</p>
      <p><strong>Estimated Delivery:</strong> ${deliveryDate}</p>
      ${listItems(items)}
      <div style="margin-top:18px; padding:16px; background:#f8f4ec; border:1px solid #d8d3c7; border-radius:16px;">
        <p style="margin:0 0 8px;"><strong>Shipping:</strong> ${shippingAmount}</p>
        <p style="margin:0 0 8px;"><strong>Discount:</strong> ${discountAmount}</p>
        <p style="margin:0;"><strong>Total Amount:</strong> ${totalAmount}</p>
      </div>
      <p style="margin-top:18px;"><strong>Delivery Address:</strong><br/>${addressText}</p>
      <p style="margin-top:18px;">You can also download the full invoice from your order page after logging in.</p>
    `,
  }),
});

export const buildCanceledEmail = ({ userName, orderId, canceledDate, refundMessage, items = [], totalAmount, paymentMethod }) => ({
  subject: `Order ${orderId} was canceled`,
  html: baseTemplate({
    title: "Order Canceled",
    preview: `Order ${orderId} was canceled successfully.`,
    body: `
      <p>Hi ${userName},</p>
      <p>Your order <strong>${orderId}</strong> was canceled on <strong>${canceledDate}</strong>.</p>
      ${items.length ? listItems(items) : ""}
      <div style="margin-top:18px; padding:16px; background:#f8f4ec; border:1px solid #d8d3c7; border-radius:16px;">
        <p style="margin:0 0 8px;"><strong>Payment Method:</strong> ${paymentMethod}</p>
        <p style="margin:0;"><strong>Order Total:</strong> ${totalAmount}</p>
      </div>
      <p style="margin-top:18px;">${refundMessage}</p>
      <p style="margin-top:18px;">If you need help, reply to this email and the SageCart support team will assist you.</p>
    `,
  }),
});

export const buildDeliveredEmail = ({ userName, orderId, deliveredDate }) => ({
  subject: `Your SageCart order ${orderId} was delivered`,
  html: baseTemplate({
    title: "Order Delivered",
    preview: `Order ${orderId} has been delivered.`,
    body: `
      <p>Hi ${userName},</p>
      <p>Your order was delivered on ${deliveredDate}.</p>
      <p>If you need a return, you can request it from the order details page within 7 days of delivery.</p>
    `,
  }),
});

export const buildRefundEmail = ({ userName, orderId, refundDate, totalAmount, paymentMethod }) => ({
  subject: `Refund completed for order ${orderId}`,
  html: baseTemplate({
    title: "Refund Completed",
    preview: `The refund for order ${orderId} has been completed.`,
    body: `
      <p>Hi ${userName},</p>
      <p>Your refund for order ${orderId} was completed on ${refundDate}.</p>
      <div style="margin-top:18px; padding:16px; background:#f8f4ec; border:1px solid #d8d3c7; border-radius:16px;">
        <p style="margin:0 0 8px;"><strong>Refund Amount:</strong> ${totalAmount}</p>
        <p style="margin:0;"><strong>Refund Method:</strong> ${paymentMethod}</p>
      </div>
      <p>The refunded amount should reflect in your payment source shortly depending on your bank or provider.</p>
    `,
  }),
});
