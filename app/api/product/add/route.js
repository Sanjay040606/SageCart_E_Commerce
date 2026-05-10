import connectDB from "@/config/db";
import Product from "@/models/Product";
import { getAuth } from "@clerk/nextjs/server";
import { v2 as cloudinary } from "cloudinary";
import authSeller from "@/lib/authSeller";
import { getProductStatusFromStock } from "@/lib/productStock";
import { NextResponse } from "next/server";
import { buildVariantOptionsFromValues, inferCategoryVariantMode, parseDelimitedValues } from "@/lib/productVariantRules";

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

const buildCombinedStorageVariantOptions = ({
    colors = [],
    variants = [],
    images = [],
    fallbackImage = ""
}) => {
    const colorList = parseDelimitedValues(colors);
    const variantList = parseDelimitedValues(variants);

    if (!colorList.length || !variantList.length) return [];

    return colorList.flatMap((color, colorIndex) => {
        const colorImage = String(images[colorIndex] ?? images[0] ?? fallbackImage ?? "").trim();

        return variantList.map((variant, variantIndex) => {
            const label = `${color} / ${variant}`;

            return {
                id: slugifyText(`storage-${color}-${variant}-${colorIndex}-${variantIndex}`),
                label,
                type: "storage",
                color,
                storage: variant,
                description: `Color: ${color} • Configuration: ${variant}`,
                image: colorImage ? [colorImage] : [],
                images: colorImage ? [colorImage] : [],
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
        const parsedColorValues = parseDelimitedValues(colorValues);
        const parsedVariantValues = parseDelimitedValues(variantValues);

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

        const result = await Promise.all(
            files.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                return new Promise( (resolve , reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {resource_type: 'auto'},
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
            fallbackImage
        });

        if (resolvedVariantMode === 'storage') {
            if (hasColorEntries && hasVariantEntries) {
                variantOptions = buildCombinedStorageVariantOptions({
                    colors: parsedColorValues,
                    variants: parsedVariantValues,
                    images: image,
                    fallbackImage
                });
            } else if (hasColorEntries) {
                variantOptions = buildVariantOptionsFromValues({
                    category: "Color",
                    values: parsedColorValues,
                    images: image,
                    fallbackImage
                });
            }
        }

        const manualSourceId = `manual-${String(userId || "seller").trim()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const normalizedName = String(name || "").trim();
        const normalizedCategory = String(category || "").trim();

        const newProduct = await Product.create({
            userId,
            name: normalizedName,
            description: String(description || "").trim(),
            category: normalizedCategory,
            price:Number(price),
            offerPrice:Number(offerPrice),
            stock: Math.max(0, stock),
            status: getProductStatusFromStock(Math.max(0, stock)),
            image,
            promoCode,
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
                category: normalizedCategory,
                slug: slugifyText(normalizedName)
            }

        })

        return NextResponse.json({ success: true, message: 'Upload successful', newProduct })

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message })
    }
    
}
