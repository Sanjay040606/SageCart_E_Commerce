import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
import {
    buildProductSearchTokens,
    matchesSearchTokens,
    normalizeSearchText
} from "@/lib/productSearch";

const SEARCH_FIELDS = [
    "name",
    "description",
    "category",
    "brand",
    "slug",
    "datasetMeta.brand",
    "datasetMeta.category",
    "datasetMeta.slug",
    "datasetMeta.sellerName",
    "sellerName",
    "colors",
    "sizes",
    "variantOptions.label",
    "variantOptions.name",
    "variantOptions.title"
];

const escapeRegex = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchTerms = (value) => {
    const normalized = normalizeSearchText(value);
    if (!normalized) return [];

    const terms = new Set();
    const tokens = normalized.split(" ").filter(Boolean);

    tokens.forEach((token) => {
        if (token.length > 1) {
            terms.add(token);

            if (token.length > 3 && token.endsWith("s")) {
                terms.add(token.slice(0, -1));
            }
        }
    });

    if (terms.size === 0 && tokens[0]) {
        terms.add(tokens[0]);
    }

    return Array.from(terms);
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ success: true, products: [] });
        }

        await connectDB();

        const searchTerms = buildSearchTerms(query);
        const matchStage = searchTerms.length > 0
            ? {
                $match: {
                    $or: searchTerms.flatMap((term) =>
                        SEARCH_FIELDS.map((field) => ({
                            [field]: { $regex: escapeRegex(term), $options: "i" }
                        }))
                    )
                }
            }
            : null;

        const pipeline = [];
        if (matchStage) {
            pipeline.push(matchStage);
        }
        pipeline.push(...buildCatalogSummaryPipeline());
        pipeline.push({ $limit: 40 });

        const products = await Product.aggregate(pipeline);

        const matchedProducts = products
            .filter(isCatalogProductVisible)
            .filter((product) => matchesSearchTokens(buildProductSearchTokens(product), query))
            .slice(0, 8);

        return NextResponse.json({ success: true, products: matchedProducts });

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message });
    }
}
