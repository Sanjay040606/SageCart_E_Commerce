import connectDB from "@/config/db";
import authSeller from "@/lib/authSeller";
import Product from "@/models/Product";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";

export async function GET(request) {
    try {
        
        const { userId } = getAuth(request)

        const isSeller = await authSeller(userId)

        if (!isSeller) {
            return NextResponse.json({success: false, message: 'not authorized'});
        }

        await connectDB()

        const products = await Product.aggregate(buildCatalogSummaryPipeline())
        return NextResponse.json(
            { success: true, products },
            {
                headers: {
                    "Cache-Control": "no-store, max-age=0"
                }
            }
        )

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message})
    }
}
