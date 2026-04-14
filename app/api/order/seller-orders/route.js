import connectDB from "@/config/db";
import authSeller from "@/lib/authSeller";
import Address from "@/models/Address";
import Order from "@/models/Order";
import { sendOrderLifecycleEmailsIfNeeded } from "@/lib/emailNotifications";
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

        Address.length

        const orders = await Order.find({}).populate('address items.product')

        for (const order of orders) {
            const { changed } = syncOrderWithSystemTime(order)
            if (changed) {
                await order.save()
            }
            await sendOrderLifecycleEmailsIfNeeded(order)
        }

        return NextResponse.json({ success: true , orders})

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message})
    }
}
