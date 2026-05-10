import connectDB from "@/config/db";
import Product from "@/models/Product";
import { buildStockUpdateOperations } from "@/lib/stockSeeder";
import { NextResponse } from "next/server";

const BATCH_SIZE = 500;

const chunkArray = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

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
    const products = await Product.find({}).lean();

    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No products found to seed'
      });
    }

    const { operations, preview, summary } = buildStockUpdateOperations(products, {
      highStockValue: 500,
      lowStockRange: [1, 5]
    });

    const bulkSummary = {
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0
    };

    for (const batch of chunkArray(operations, BATCH_SIZE)) {
      if (batch.length === 0) continue;

      const result = await Product.bulkWrite(batch, { ordered: false });
      bulkSummary.matchedCount += result.matchedCount || 0;
      bulkSummary.modifiedCount += result.modifiedCount || 0;
      bulkSummary.upsertedCount += result.upsertedCount || 0;
    }

    return NextResponse.json({
      success: true,
      message: `Seeded stock for ${operations.length} products`,
      updated: preview,
      summary: {
        ...summary,
        matched: bulkSummary.matchedCount,
        modified: bulkSummary.modifiedCount,
        upserted: bulkSummary.upsertedCount
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
