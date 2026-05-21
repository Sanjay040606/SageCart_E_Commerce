import connectDB from "@/config/db";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
import {
    buildProductSearchTokens,
    buildSearchTerms,
    getPrimarySearchFamily,
    getProductSearchScore,
    matchesSearchTokens,
    prepareSearchQuery
} from "@/lib/productSearch";

const SEARCH_FIELDS = [
    "name",
    "title",
    "category",
    "brand",
    "slug",
    "datasetMeta.brand",
    "datasetMeta.category",
    "datasetMeta.slug"
];

const SEARCH_CANDIDATE_LIMIT = 200;

const escapeRegex = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildWordPattern = (value) => {
    const term = String(value ?? "").trim();
    if (!term) return "";

    const escaped = escapeRegex(term).replace(/\s+/g, "\\s+");
    if (term.replace(/\s+/g, "").length < 3) {
        return `(?:^|[^a-z0-9])${escaped}`;
    }

    return `(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`;
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query || query.trim().length < 2) {
            return NextResponse.json({ success: true, products: [] });
        }

        await connectDB();

        const preparedQuery = prepareSearchQuery(query);
        const searchTerms = buildSearchTerms(query);
        const matchStage = searchTerms.length > 0
            ? {
                $match: {
                    $or: searchTerms.flatMap((term) =>
                        SEARCH_FIELDS.map((field) => ({
                            [field]: { $regex: buildWordPattern(term), $options: "i" }
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
        pipeline.push({ $limit: SEARCH_CANDIDATE_LIMIT });

        const products = await Product.aggregate(pipeline);

        const matchedProducts = products
            .filter(isCatalogProductVisible)
            .map((product) => {
                const searchTokens = buildProductSearchTokens(product);
                return {
                    product,
                    searchTokens,
                    searchFamily: getPrimarySearchFamily(searchTokens)
                };
            })
            .filter(({ product, searchTokens, searchFamily }) => {
                if (!matchesSearchTokens(searchTokens, query, preparedQuery)) {
                    return false;
                }

                if (!preparedQuery.queryFamily) {
                    return true;
                }

                const normalizedName = String(product?.name ?? product?.title ?? "").toLowerCase().trim();
                const normalizedCategory = String(product?.category ?? "").toLowerCase().trim();
                const normalizedBrand = String(product?.brand ?? product?.datasetMeta?.brand ?? "").toLowerCase().trim();
                const normalizedSlug = String(product?.slug ?? product?.datasetMeta?.slug ?? "").toLowerCase().trim();

                return (
                    searchFamily === preparedQuery.queryFamily ||
                    normalizedName === preparedQuery.normalizedQuery ||
                    normalizedCategory === preparedQuery.normalizedQuery ||
                    normalizedBrand === preparedQuery.normalizedQuery ||
                    normalizedSlug === preparedQuery.normalizedQuery
                );
            })
            .map((product) => ({
                product: product.product,
                searchScore: getProductSearchScore(product.product, query, {
                    searchTokens: product.searchTokens,
                    searchFamily: product.searchFamily
                }, preparedQuery)
            }))
            .sort((a, b) => {
                const scoreDiff = b.searchScore - a.searchScore;
                if (scoreDiff !== 0) return scoreDiff;

                const ratingDiff = Number(b.product?.rating || 0) - Number(a.product?.rating || 0);
                if (ratingDiff !== 0) return ratingDiff;

                const reviewDiff = Number(b.product?.ratingsCount || 0) - Number(a.product?.ratingsCount || 0);
                if (reviewDiff !== 0) return reviewDiff;

                return Number(b.product?.date || 0) - Number(a.product?.date || 0);
            })
            .map(({ product }) => product)
            .slice(0, 8);

        return NextResponse.json(
            { success: true, products: matchedProducts },
            {
                headers: {
                    "Cache-Control": "no-store, max-age=0"
                }
            }
        );

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message });
    }
}
