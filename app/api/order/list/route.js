import connectDB from "@/config/db";
import Order from "@/models/Order";
import { hydrateOrderSummaries } from "@/lib/orderHydration";
import { syncOrderWithSystemTime } from "@/lib/orderLifecycle";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";



export async function GET(request) {
    try {
        
        const { userId } = getAuth(request)
        const url = new URL(request.url)
        const requestedPage = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
        const requestedLimit = parseInt(url.searchParams.get("limit") || "20", 10) || 20
        const limit = Math.min(Math.max(requestedLimit, 1), 50)

        if (!userId) {
          return NextResponse.json({
            success: true,
            orders: [],
            pagination: {
              page: requestedPage,
              limit,
              totalOrders: 0,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false
            }
          })
        }

        await connectDB()

        const totalOrders = await Order.countDocuments({ userId })
        const totalPages = Math.max(1, Math.ceil(totalOrders / limit))
        const page = Math.min(requestedPage, totalPages)
        const skip = (page - 1) * limit

        if (totalOrders === 0) {
          return NextResponse.json({
            success: true,
            orders: [],
            pagination: {
              page,
              limit,
              totalOrders,
              totalPages,
              hasNextPage: false,
              hasPrevPage: false
            }
          })
        }

        const orders = await Order.find({ userId })
          .select("items amount amountInr originalTotalInr subTotalInr gstInr shippingInr discountInr paymentDiscountInr promoCode paymentMethod status statusTimeline estimatedDeliveryDate date shippedAt canceledAt refundRequestedAt refundCompletedAt deliveredAt stockRestored needsStockRestoration")
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit)

    for (const order of orders) {
        syncOrderWithSystemTime(order)
    }

    const plainOrders = await hydrateOrderSummaries(orders, "name image")

    return NextResponse.json({
        success: true,
        orders: plainOrders,
        pagination: {
            page,
            limit,
            totalOrders,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    })

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message })
    }
}
