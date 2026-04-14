import connectDB from "@/config/db";
import Product from "@/models/Product";
import { syncProductStatus } from "@/lib/productStock";
import { NextResponse } from "next/server";
import { handleDatabaseError } from "@/lib/errorHandler";

export async function GET(request) {
    try {


        await connectDB()

        const products = await Product.find({})
        await Promise.all(products.map(async (product) => {
            if (syncProductStatus(product)) {
                await product.save()
            }
        }))
        return NextResponse.json({ success: true , products })

    } catch (error) {
        return NextResponse.json({ success: false, message: handleDatabaseError(error)})
    }
}