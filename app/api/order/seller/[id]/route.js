import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import connectDB from "@/config/db";
import authSeller from "@/lib/authSeller";
import { sendOrderLifecycleEmailsIfNeeded } from "@/lib/emailNotifications";
import { hydrateOrderDocument } from "@/lib/orderHydration";
import { syncOrderWithSystemTime } from "@/lib/orderLifecycle";
import Order from "@/models/Order";
import User from "@/models/User";

export async function GET(request, { params }) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const isSeller = await authSeller(userId);

    if (!isSeller) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 403 }
      );
    }

    await connectDB();

    const order = await Order.findById(params.id);

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
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
      console.error("Failed to send seller order lifecycle email:", emailError);
    }

    const hydratedOrder = await hydrateOrderDocument(order, {
      userSelect: "name email imageUrl",
      addressSelect: "fullName area city state phoneNumber pincode",
      productSelect: "name image price offerPrice reviews"
    });

    return NextResponse.json(
      { success: true, order: hydratedOrder },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
