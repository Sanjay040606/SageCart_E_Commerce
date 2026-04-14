import connectDB from "@/config/db";
import Product from "@/models/Product";
import { getAuth } from "@clerk/nextjs/server";
import { v2 as cloudinary } from "cloudinary";
import authSeller from "@/lib/authSeller";
import { getProductStatusFromStock } from "@/lib/productStock";
import { NextResponse } from "next/server";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

export async function POST(request) {

    try {
        
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

        const files = formData.getAll('images');

        // Validate promo code only if provided
        if (promoCode) {
            await connectDB();
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

        const newProduct = await Product.create({
            userId,
            name,
            description,
            category,
            price:Number(price),
            offerPrice:Number(offerPrice),
            stock: Math.max(0, stock),
            status: getProductStatusFromStock(Math.max(0, stock)),
            image,
            promoCode,
            date: Date.now()

        })

        return NextResponse.json({ success: true, message: 'Upload successful', newProduct })

    } catch (error) {
        NextResponse.json({ success: false, message: error.message })
    }
    
}