import connectDB from "@/config/db";
import { inngest } from "@/config/inngest";
import Product from "@/models/Product";
import User from "@/models/User";
import Order from "@/models/Order";
import { convertUSDToINR } from "@/lib/currencyUtils";
import { getOrderMilestones, ORDER_STATUSES } from "@/lib/orderLifecycle";
import { sendOrderPlacedEmailIfNeeded } from "@/lib/emailNotifications";
import { getGamePromo, getUnusedUserGameCoupon, normalizePromoCode } from "@/lib/promoCodes";
import { checkProductAvailability, reserveProductStock } from "@/lib/productStock";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { handleDatabaseError } from "@/lib/errorHandler";



export async function POST(request) {
    try {
        await connectDB();
        const { userId } = getAuth(request)
        const { address, items, promoCode, paymentMethod, paymentDiscountInr = 0 } = await request.json()

        if(!address || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid data'});
        }

        const user = await User.findById(userId)
        if (!user) {
            return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
        }

        const productIds = items.map(item => item.product);
        const productDocs = await Product.find({_id: {$in: productIds}});
        const productMap = new Map(productDocs.map(p => [p._id.toString(), p]));

        // Check product availability before processing order
        const availabilityCheck = await checkProductAvailability(items);
        if (!availabilityCheck.available) {
            return NextResponse.json({
                success: false,
                message: 'Some products are out of stock or have insufficient quantity',
                unavailableProducts: availabilityCheck.unavailableProducts
            }, { status: 400 });
        }

        let productUsdTotal = 0;
        let originalProductUsdTotal = 0;
        let matchingPromoProductInr = 0;

        items.forEach((item) => {
            const product = productMap.get(item.product);
            if (!product) throw new Error('Product not found')

            const quantity = item.quantity || 0;
            productUsdTotal += product.offerPrice * quantity;
            originalProductUsdTotal += product.price * quantity;

            if (product.promoCode && promoCode && product.promoCode.toUpperCase() === promoCode.trim().toUpperCase()) {
                matchingPromoProductInr += convertUSDToINR(product.offerPrice * quantity);
            }
        });

        const COUPON_DISCOUNT_RATE = 0.10;
        const SHIPPING_DEFAULT = 50;
        const productInrTotal = convertUSDToINR(productUsdTotal);
        const originalProductInrTotal = convertUSDToINR(originalProductUsdTotal);
        const totalShippingFee = items.length * SHIPPING_DEFAULT;

        const promoCodeNormalized = normalizePromoCode(promoCode);
        const gamePromo = getGamePromo(promoCodeNormalized);
        const userGameCoupon = getUnusedUserGameCoupon(user, promoCodeNormalized);
        const validFreeShipping = gamePromo?.type === 'shipping' && Boolean(userGameCoupon);
        const validProductPromo = matchingPromoProductInr > 0;
        const validGamePercentPromo = gamePromo?.type === 'percent' && Boolean(userGameCoupon);
        const validPromo = validFreeShipping || validProductPromo || validGamePercentPromo;

        if (promoCodeNormalized && !validPromo) {
            return NextResponse.json({ success: false, message: 'Invalid or already used promo code' }, { status: 400 })
        }

        const discountInr = validProductPromo
            ? Math.round(matchingPromoProductInr * COUPON_DISCOUNT_RATE)
            : validGamePercentPromo
                ? Math.round(productInrTotal * (gamePromo.value / 100))
                : 0;
        let shippingInr = totalShippingFee;

        if (validFreeShipping) {
            shippingInr = 0;
        } else if (validProductPromo) {
            const matchedShippingDiscount = items.reduce((acc, item) => {
                const product = productMap.get(item.product);
                if (product?.promoCode && product.promoCode.toUpperCase() === promoCodeNormalized) {
                    return acc + SHIPPING_DEFAULT;
                }
                return acc;
            }, 0);
            shippingInr = Math.max(0, totalShippingFee - matchedShippingDiscount);
        }

        const amountAfterCoupon = productInrTotal - discountInr;
        const effectivePaymentDiscount = (paymentMethod === 'UPI' || paymentMethod === 'CARD') ?
          (paymentDiscountInr != null && paymentDiscountInr !== '' ? Number(paymentDiscountInr) : 60)
          : 0;

        const totalInr = Math.max(0, amountAfterCoupon - effectivePaymentDiscount + shippingInr);
        const totalUsd = Number((totalInr / 94).toFixed(2));

        const placedAt = new Date()
        const { deliveryEta } = getOrderMilestones({ date: placedAt.getTime() })

        const order = await Order.create({
            userId,
            items,
            amount: totalUsd,
            amountInr: totalInr,
            originalTotalInr: originalProductInrTotal,
            subTotalInr: productInrTotal,
            shippingInr,
            discountInr,
            paymentDiscountInr: effectivePaymentDiscount,
            promoCode: validPromo ? promoCodeNormalized : "",
            paymentMethod: paymentMethod || 'COD',
            address,
            status: ORDER_STATUSES.CONFIRMED,
            statusTimeline: [
                {
                    status: ORDER_STATUSES.CONFIRMED,
                    timestamp: placedAt,
                    message: 'Your order has been confirmed.'
                }
            ],
            estimatedDeliveryDate: deliveryEta,
            date: placedAt.getTime()
        });

        if (userGameCoupon) {
            user.gameCoupons = (user.gameCoupons || []).map((coupon) =>
                coupon.code === promoCodeNormalized
                    ? { ...coupon.toObject?.(), usedAt: new Date() }
                    : coupon
            )
        }

        // (Optional) send event for async processing if needed
        // await inngest.send({
        //     name: 'order/created',
        //     data: {
        //         userId,
        //         address,
        //         items,
        //         amount: totalUsd,
        //         amountInr: totalInr,
        //         gstInr,
        //         shippingInr,
        //         discountInr,
        //         promoCode: validPromo ? PROMO_CODE : "",
        //         date: Date.now()
        //     }
        // })

        // clear user cart
        user.cartItems = {}
        await user.save()

        // Reserve product stock after successful order creation
        try {
            await reserveProductStock(items);
        } catch (stockError) {
            console.error('Failed to reserve product stock:', stockError);
            // Note: Order is already created, but stock reservation failed
            // This should be handled by inventory management system
        }

        const emailOrder = await Order.findById(order._id)
          .populate('items.product', 'name offerPrice')
          .populate('address', 'fullName area city state phoneNumber')

        void sendOrderPlacedEmailIfNeeded({ order: emailOrder, user }).catch((emailError) => {
            console.error('Failed to send order placed email:', emailError)
        })

        return NextResponse.json({ success: true, message: 'Order Placed', order })

    } catch (error) {
        console.log(error)
        return NextResponse.json({ success: false, message: handleDatabaseError(error)})
    }
}
