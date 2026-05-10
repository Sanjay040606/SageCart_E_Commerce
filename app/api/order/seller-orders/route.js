import connectDB from "@/config/db";
import authSeller from "@/lib/authSeller";
import Order from "@/models/Order";
import User from "@/models/User";
import { hydrateOrderSummaries } from "@/lib/orderHydration";
import { syncOrderWithSystemTime } from "@/lib/orderLifecycle";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";



export async function GET(request) {
    try {
        
        const { userId } = getAuth(request)

        const isSeller = await authSeller(userId)

        if (!isSeller) {
            return NextResponse.json({ success: false, message: 'not authorized'})
        }

        await connectDB()
        const url = new URL(request.url)
        const requestedPage = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
        const requestedLimit = parseInt(url.searchParams.get("limit") || "20", 10) || 20
        const limit = Math.min(Math.max(requestedLimit, 1), 50)

        const totalOrders = await Order.countDocuments({})
        const totalPages = Math.max(1, Math.ceil(totalOrders / limit))
        const page = Math.min(requestedPage, totalPages)
        const skip = (page - 1) * limit

        const orders = await Order.find({})
            .select("userId items amount amountInr originalTotalInr subTotalInr gstInr shippingInr discountInr paymentDiscountInr promoCode paymentMethod status statusTimeline estimatedDeliveryDate date shippedAt canceledAt refundRequestedAt refundCompletedAt deliveredAt stockRestored needsStockRestoration")
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)

        for (const order of orders) {
            const { changed } = syncOrderWithSystemTime(order)
            if (changed) {
                await order.save()
            }
        }

        const plainOrders = await hydrateOrderSummaries(orders, "name image")
        const buyerIds = Array.from(
            new Set(
                plainOrders
                    .map((order) => String(order.userId || "").trim())
                    .filter(Boolean)
            )
        )
        const buyers = buyerIds.length > 0
            ? await User.find({ _id: { $in: buyerIds } }).select("name email imageUrl").lean()
            : []
        const buyerMap = new Map(buyers.map((buyer) => [String(buyer._id), buyer]))
        const ordersWithBuyers = plainOrders.map((order) => ({
            ...order,
            buyer: buyerMap.get(String(order.userId)) || null
        }))

        return NextResponse.json({
            success: true,
            orders: ordersWithBuyers,
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
        return NextResponse.json({ success: false, message: error.message})
    }
}
