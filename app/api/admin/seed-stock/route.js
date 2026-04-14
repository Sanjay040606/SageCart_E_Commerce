import connectDB from "@/config/db";
import Product from "@/models/Product";
import { getProductStatusFromStock } from "@/lib/productStock";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/seed-stock
 * Development-only endpoint to populate existing products with varied stock values
 * Call with: post with a token or authorization header
 */
export async function POST(request) {
  try {
    // Security: only allow in development or if a seed token is provided
    const isAllowed = 
      process.env.NODE_ENV === 'development' || 
      request.headers.get('x-seed-token') === process.env.SEED_TOKEN;

    if (!isAllowed) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();
    const products = await Product.find({});

    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No products found to seed'
      });
    }

    const results = [];
    let updated = 0;

    // Assign stock in pattern: 10 -> 5 -> 0 -> 10 -> 5 -> 0 ...
    for (let i = 0; i < products.length; i++) {
      const pattern = i % 3;
      let stockValue;

      if (pattern === 0) {
        stockValue = 10;
      } else if (pattern === 1) {
        stockValue = 5;
      } else {
        stockValue = 0;
      }

      const newStatus = getProductStatusFromStock(stockValue);

      // Only update if stock is 0 (default/unset)
      if (products[i].stock === 0 || products[i].stock == null) {
        products[i].stock = stockValue;
        products[i].status = newStatus;
        await products[i].save();
        updated++;

        results.push({
          id: products[i]._id,
          name: products[i].name,
          stock: stockValue,
          status: newStatus
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeded stock for ${updated} products`,
      updated: results,
      summary: {
        total: products.length,
        updated: updated,
        distribution: {
          stock_10: Math.ceil(products.length / 3),
          stock_5: Math.floor(products.length / 3),
          stock_0: Math.floor(products.length / 3)
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
