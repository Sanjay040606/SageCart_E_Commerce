import connectDB from "@/config/db";
import Address from "@/models/Address";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { sendOrderLifecycleEmailsIfNeeded } from "@/lib/emailNotifications";
import { syncOrderWithSystemTime } from "@/lib/orderLifecycle";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";



export async function GET(request) {
    try {
        
        const { userId } = getAuth(request)

        await connectDB()

    Address.length
    Product.length

    const orders = await Order.find({userId}).populate('address items.product')

    for (const order of orders) {
        const { changed } = syncOrderWithSystemTime(order)
        if (changed) {
            await order.save()
        }

        void sendOrderLifecycleEmailsIfNeeded(order).catch((emailError) => {
            console.error('Failed to send order lifecycle email:', emailError)
        })
    }

    return NextResponse.json({ success: true, orders })

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message })
    }
}
