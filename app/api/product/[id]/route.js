import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { resolveOrderProductId } from "@/lib/orderUtils";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
import { getCachedCatalogSnapshot } from "@/lib/catalogSnapshot";
import { getProductCatalogKey } from "@/lib/productCatalog";

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const isManualCatalogProduct = (product = {}) =>
  normalizeText(product?.source || product?.datasetMeta?.source) === "manual";

const findPreferredCatalogSibling = (product, catalogProducts = []) => {
  const productKey = getProductCatalogKey(product);
  if (productKey) {
    const keyMatch = catalogProducts.find((item) => getProductCatalogKey(item) === productKey);
    if (keyMatch) return keyMatch;
  }

  const productName = normalizeText(product?.name);
  const productCategory = normalizeText(product?.category);
  if (!productName) return null;

  return catalogProducts.find((item) => {
    if (!isManualCatalogProduct(item)) return false;
    return normalizeText(item?.name) === productName && normalizeText(item?.category) === productCategory;
  }) || null;
};

export async function GET(request, { params }) {
  try {
    await connectDB();

    const productId = resolveOrderProductId(params.id);
    if (!productId) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    let product = await Product.findById(productId).lean();
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
    }

    if (!isManualCatalogProduct(product)) {
      const cachedSnapshot = getCachedCatalogSnapshot();
      const sibling = findPreferredCatalogSibling(product, cachedSnapshot?.catalogProducts || []);
      if (sibling && String(sibling._id) !== String(product._id)) {
        const preferredProduct = await Product.findById(sibling._id).lean();
        if (preferredProduct && isCatalogProductVisible(preferredProduct)) {
          product = preferredProduct;
        }
      }
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
