import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { handleDatabaseError } from "@/lib/errorHandler";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { isCatalogProductVisible } from "@/lib/productVariantRules";

export async function GET(request) {
    try {
        await connectDB()

        const products = (await Product.aggregate(buildCatalogSummaryPipeline())).filter(isCatalogProductVisible)
        return NextResponse.json(
            { success: true, products },
            {
                headers: {
                    "Cache-Control": "public, max-age=30, stale-while-revalidate=300"
                }
            }
        )

    } catch (error) {
        return NextResponse.json({ success: false, message: handleDatabaseError(error)})
    }
}
