import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { resolveOrderProductId } from "@/lib/orderUtils";
import { isCatalogProductVisible } from "@/lib/productVariantRules";

export async function GET(request, { params }) {
  try {
    await connectDB();

    const productId = resolveOrderProductId(params.id);
    if (!productId) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (!isCatalogProductVisible(product)) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, product },
      {
        headers: {
          "Cache-Control": "public, max-age=15, stale-while-revalidate=60"
        }
      }
    );
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
