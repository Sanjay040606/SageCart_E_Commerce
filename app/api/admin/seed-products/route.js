import { NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import connectDB from "@/config/db";
import authSeller from "@/lib/authSeller";
import Product from "@/models/Product";
import { buildSeedProducts } from "@/lib/productSeedCatalog";

export async function POST(request) {
  try {
    const { userId } = getAuth(request);
    const isSeller = await authSeller(userId);

    if (!isSeller) {
      return NextResponse.json({ success: false, message: "not authorized" }, { status: 401 });
    }

    await connectDB();

    const seededProducts = buildSeedProducts(userId);
    const results = [];

    for (const productData of seededProducts) {
      const { userId: seedUserId, ...seedFields } = productData;
      const hasPromoCode = Boolean(seedFields.promoCode);
      const update = {
        $set: {
          ...seedFields,
          userId: seedUserId
        }
      };

      if (!hasPromoCode) {
        delete update.$set.promoCode;
        update.$unset = { promoCode: "" };
      }

      const product = await Product.findOneAndUpdate(
        { userId: seedUserId, name: seedFields.name },
        update,
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

      results.push(product);
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} products`,
      products: results
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
