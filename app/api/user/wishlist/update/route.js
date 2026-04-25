import connectDB from "@/config/db";
import User from "@/models/User";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(request) {
    try {
        const { userId } = getAuth(request);
        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ success: false, message: 'Product ID is required' }, { status: 400 });
        }

        await connectDB();
        const user = await User.findById(userId);

        if (!user) {
            return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }

        const wishlist = user.wishlistItems || [];
        
        if (wishlist.includes(productId)) {
            user.wishlistItems = wishlist.filter(id => id !== productId);
        } else {
            user.wishlistItems = [...wishlist, productId];
        }

        await user.save();

        return NextResponse.json({ success: true, wishlistItems: user.wishlistItems });

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
