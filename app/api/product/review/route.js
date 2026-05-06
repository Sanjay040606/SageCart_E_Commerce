import connectDB from "@/config/db";
import Product from "@/models/Product";
import Order from "@/models/Order";
import User from "@/models/User";
import { sendOrderLifecycleEmailsIfNeeded } from "@/lib/emailNotifications";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canLeaveReview, syncOrderWithSystemTime } from "@/lib/orderLifecycle";
import { resolveOrderProductId } from "@/lib/orderUtils";

export async function POST(request) {
    try {
        const { userId } = getAuth(request);
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { productId, rating, comment } = await request.json();
        const resolvedProductId = resolveOrderProductId(productId);
        const numericRating = Number(rating);
        const trimmedComment = comment?.trim();

        if (!resolvedProductId || !Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5 || !trimmedComment) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        await connectDB();

        const purchasedOrders = await Order.find({
            userId: userId,
            $or: [
                { 'items.product': productId },
                { 'items.productId': productId }
            ]
        }).sort({ date: -1 });

        let eligibleOrder = null;
        for (const purchaseOrder of purchasedOrders) {
            const { changed } = syncOrderWithSystemTime(purchaseOrder, new Date());
            if (changed) {
                await purchaseOrder.save();
            }

            try {
                await sendOrderLifecycleEmailsIfNeeded(purchaseOrder);
            } catch (emailError) {
                console.error('Failed to send order lifecycle email:', emailError);
            }

            if (canLeaveReview(purchaseOrder)) {
                eligibleOrder = purchaseOrder;
                break;
            }
        }

        if (!eligibleOrder) {
            return NextResponse.json({ success: false, message: 'You can review this product only after a delivered order from your account.' }, { status: 403 });
        }

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
        }

        const product = await Product.findById(resolvedProductId);
        if (!product) {
            return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
        }

        // Check if user already reviewed
        const existingReviewIndex = product.reviews.findIndex(r => r.userId === userId);
        const hasExistingReview = existingReviewIndex >= 0;

        if (hasExistingReview) {
            product.reviews[existingReviewIndex].rating = numericRating;
            product.reviews[existingReviewIndex].comment = trimmedComment;
            product.reviews[existingReviewIndex].date = new Date();
        } else {
            product.reviews.push({
                userId,
                name: user.name,
                rating: numericRating,
                comment: trimmedComment,
                date: new Date()
            });
        }

        await product.save();

        return NextResponse.json({
            success: true,
            message: hasExistingReview ? 'Review updated successfully' : 'Review submitted successfully',
            reviews: product.reviews
        });

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
