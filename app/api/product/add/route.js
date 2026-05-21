import connectDB from "@/config/db";
import Product from "@/models/Product";
import { getAuth } from "@clerk/nextjs/server";
import { v2 as cloudinary } from "cloudinary";
import authSeller from "@/lib/authSeller";
import { getProductStatusFromStock } from "@/lib/productStock";
import { invalidateCatalogSnapshot } from "@/lib/catalogSnapshot";
import { NextResponse } from "next/server";
import {
    buildVariantOptionsFromValues,
    inferCategoryVariantMode,
    parseDelimitedPrices,
    parseDelimitedValues,
    normalizeVariantPricingPair
} from "@/lib/productVariantRules";
import { convertINRToUSD, convertUSDToINR } from "@/lib/currencyUtils";

const MAX_PRODUCT_IMAGE_SIZE_MB = 5;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = MAX_PRODUCT_IMAGE_SIZE_MB * 1024 * 1024;
const CLOUDINARY_PRODUCT_FOLDER = process.env.CLOUDINARY_PRODUCT_FOLDER?.trim() || "sagecart";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

const slugifyText = (value) =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const convertUsdFieldToInr = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? convertUSDToINR(parsed) : null;
};

const normalizeBasePricing = ({ price, offerPrice }) => {
    return normalizeVariantPricingPair(
        convertUsdFieldToInr(offerPrice),
        convertUsdFieldToInr(price)
    );
};

const deriveSummaryPricingFromVariants = (variantOptions = []) => {
    const normalizedOptions = Array.isArray(variantOptions)
        ? variantOptions
            .map((option) =>
                normalizeVariantPricingPair(option?.offerPriceInr ?? option?.priceInr, option?.originalPriceInr)
            )
            .filter((option) => Number.isFinite(option.priceInr) || Number.isFinite(option.originalPriceInr))
        : [];

    if (!normalizedOptions.length) {
        return null;
    }

    return [...normalizedOptions].sort((a, b) => {
        const aPrice = Number.isFinite(a.priceInr) ? a.priceInr : Number.MAX_SAFE_INTEGER;
        const bPrice = Number.isFinite(b.priceInr) ? b.priceInr : Number.MAX_SAFE_INTEGER;
        return aPrice - bPrice;
    })[0];
};

const buildCombinedStorageVariantOptions = ({
    colors = [],
    variants = [],
    images = [],
    fallbackImage = "",
    prices = [],
    originalPrices = []
}) => {
    const colorList = parseDelimitedValues(colors);
    const variantList = parseDelimitedValues(variants);

    if (!colorList.length || !variantList.length) return [];

    const totalCombinationCount = colorList.length * variantList.length;

    const resolvePricingIndex = (list, colorIndex, variantIndex) => {
        if (!Array.isArray(list) || list.length === 0) return null;

        if (list.length >= totalCombinationCount) {
            return colorIndex * variantList.length + variantIndex;
        }

        if (list.length >= variantList.length) {
            return variantIndex;
        }

        return Math.min(variantIndex, list.length - 1);
    };

    return colorList.flatMap((color, colorIndex) => {
        const colorImage = String(images[colorIndex] ?? images[0] ?? fallbackImage ?? "").trim();

        return variantList.map((variant, variantIndex) => {
            const label = `${color} / ${variant}`;
            const priceIndex = resolvePricingIndex(prices, colorIndex, variantIndex);
            const originalPriceIndex = resolvePricingIndex(originalPrices, colorIndex, variantIndex);
            const { priceInr, originalPriceInr } = normalizeVariantPricingPair(
                priceIndex !== null ? prices[priceIndex] : null,
                originalPriceIndex !== null ? originalPrices[originalPriceIndex] : null
            );

            return {
                id: slugifyText(`storage-${color}-${variant}-${colorIndex}-${variantIndex}`),
                label,
                type: "storage",
                color,
                storage: variant,
                description: `Color: ${color} • Configuration: ${variant}`,
                image: colorImage ? [colorImage] : [],
                images: colorImage ? [colorImage] : [],
                priceInr,
                offerPriceInr: priceInr,
                originalPriceInr,
                available: true
            };
        });
    });
};

export async function POST(request) {

    try {
        await connectDB();
        
        const { userId } = getAuth(request)

        const isSeller = await authSeller(userId)

        if (!isSeller) {
            return NextResponse.json({ success: false, message: 'not authorized'})
        }

        const formData = await request.formData()

        const name = formData.get('name');
        const description = formData.get('description');
        const brand = formData.get('brand');
        const category = formData.get('category');
        const price = formData.get('price');
        const offerPrice = formData.get('offerPrice');
        const promoCode = (formData.get('promoCode') || '').trim().toUpperCase();
        const stock = Number(formData.get('stock') || '0');
        const variantMode = String(formData.get('variantMode') || inferCategoryVariantMode(category))
            .trim()
            .toLowerCase() || 'variant';
        const colorValues = formData.get('colorValues') || '';
        const variantValues = formData.get('variantValues') || '';
        const variantPrices = formData.get('variantPrices') || '';
        const variantOfferPrices = formData.get('variantOfferPrices') || variantPrices || '';
        const variantOriginalPrices = formData.get('variantOriginalPrices') || '';
        const parsedColorValues = parseDelimitedValues(colorValues);
        const parsedVariantValues = parseDelimitedValues(variantValues);
        const parsedVariantOfferPrices = parseDelimitedPrices(variantOfferPrices);
        const parsedVariantOriginalPrices = parseDelimitedPrices(variantOriginalPrices);

        const files = formData.getAll('images');
        const hasColorEntries = parsedColorValues.length > 0;
        const hasVariantEntries = parsedVariantValues.length > 0;
        let resolvedVariantMode = variantMode;

        if (!hasColorEntries && !hasVariantEntries) {
            resolvedVariantMode = 'variant';
        } else if (variantMode === 'storage') {
            if (hasColorEntries && hasVariantEntries) {
                resolvedVariantMode = 'storage';
            } else if (hasColorEntries) {
                resolvedVariantMode = 'color';
            } else if (hasVariantEntries) {
                resolvedVariantMode = 'storage';
            } else {
                resolvedVariantMode = 'variant';
            }
        } else if (!hasVariantEntries) {
            resolvedVariantMode = 'variant';
        }

        if (promoCode) {
            const existingPromo = await Product.findOne({ promoCode });
            if (existingPromo) {
                return NextResponse.json({ success: false, message: 'promo code already exists, use a unique code'})
            }
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'no files uploaded'})
        }

        const oversizedFile = files.find((file) => typeof file?.size === 'number' && file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES);
        if (oversizedFile) {
            return NextResponse.json({
                success: false,
                message: `Each product image must be ${MAX_PRODUCT_IMAGE_SIZE_MB} MB or smaller.`
            });
        }

        const result = await Promise.all(
            files.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                return new Promise( (resolve , reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            resource_type: 'auto',
                            folder: CLOUDINARY_PRODUCT_FOLDER
                        },
                        (error , result) =>{
                            if (error) {
                                reject(error)
                            } else{
                                resolve(result)
                            }
                        }
                    )
                    stream.end(buffer)
                })
            })
        )

        const image = result.map(result => result.secure_url)
        const fallbackImage = image[0] || '';
        let variantOptions = buildVariantOptionsFromValues({
            category,
            values: parsedVariantValues,
            images: image,
            fallbackImage,
            prices: parsedVariantOfferPrices,
            originalPrices: parsedVariantOriginalPrices
        });

        if (resolvedVariantMode === 'storage') {
            if (hasColorEntries && hasVariantEntries) {
                variantOptions = buildCombinedStorageVariantOptions({
                    colors: parsedColorValues,
                    variants: parsedVariantValues,
                    images: image,
                    fallbackImage,
                    prices: parsedVariantOfferPrices,
                    originalPrices: parsedVariantOriginalPrices
                });
            } else if (hasColorEntries) {
                variantOptions = buildVariantOptionsFromValues({
                    category: "Color",
                    values: parsedColorValues,
                    images: image,
                    fallbackImage,
                    prices: parsedVariantOfferPrices,
                    originalPrices: parsedVariantOriginalPrices
                });
            }
        }

        const basePricingInr = normalizeBasePricing({ price, offerPrice });
        const summaryPricingInr = deriveSummaryPricingFromVariants(variantOptions);
        const resolvedOfferPriceInr =
            basePricingInr.priceInr ??
            basePricingInr.originalPriceInr ??
            summaryPricingInr?.priceInr ??
            summaryPricingInr?.originalPriceInr ??
            null;
        const resolvedOriginalPriceInr =
            basePricingInr.originalPriceInr ??
            basePricingInr.priceInr ??
            summaryPricingInr?.originalPriceInr ??
            summaryPricingInr?.priceInr ??
            resolvedOfferPriceInr;

        if (!resolvedOfferPriceInr && !resolvedOriginalPriceInr) {
            return NextResponse.json({
                success: false,
                message: "Please enter product price and offer price, or add variant prices so SageCart can derive them."
            });
        }

        const manualSourceId = `manual-${String(userId || "seller").trim()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const normalizedName = String(name || "").trim();
        const normalizedBrand = String(brand || "").trim();
        const normalizedCategory = String(category || "").trim();
        const productOfferPriceUsd = Number(convertINRToUSD(resolvedOfferPriceInr || 0));
        const productPriceUsd = Number(convertINRToUSD(resolvedOriginalPriceInr || resolvedOfferPriceInr || 0));

        const newProduct = await Product.create({
            userId,
            name: normalizedName,
            brand: normalizedBrand,
            description: String(description || "").trim(),
            category: normalizedCategory,
            price: productPriceUsd,
            offerPrice: productOfferPriceUsd,
            stock: Math.max(0, stock),
            status: getProductStatusFromStock(Math.max(0, stock)),
            image,
            ...(promoCode ? { promoCode } : {}),
            colors: resolvedVariantMode === 'color'
                ? (hasColorEntries ? parsedColorValues : parsedVariantValues)
                : resolvedVariantMode === 'storage'
                    ? parsedColorValues
                    : [],
            sizes: resolvedVariantMode === 'size' ? parsedVariantValues : [],
            variantMode: resolvedVariantMode,
            variantOptions,
            date: Date.now(),
            source: "manual",
            sourceId: manualSourceId,
            datasetMeta: {
                source: "manual",
                sourceId: manualSourceId,
                brand: normalizedBrand,
                category: normalizedCategory,
                slug: slugifyText(normalizedName)
            }

        })

        invalidateCatalogSnapshot();

        return NextResponse.json({ success: true, message: 'Upload successful', newProduct })

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message })
    }
    
}
