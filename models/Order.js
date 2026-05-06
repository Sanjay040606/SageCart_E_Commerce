import mongoose from "mongoose";
import { resolveOrderProductId } from "@/lib/orderUtils";

const orderItemSchema = new mongoose.Schema({
    product: {
        type: String,
        ref: 'product',
        validate: {
            validator(value) {
                return Boolean(resolveOrderProductId({ product: value, productId: this.productId }));
            },
            message: 'Path `product` is required.'
        }
    },
    productId: { type: String, default: '' },
    productName: { type: String, default: '' },
    productImage: { type: String, default: '' },
    quantity : { type: Number, required: true },
    color: { type: String, default: '' },
    variantLabel: { type: String, default: '' },
    variantType: { type: String, default: '' },
    variantPriceInr: { type: Number, default: null },
    variantOriginalPriceInr: { type: Number, default: null },
    offerPriceInr: { type: Number, default: null },
    originalPriceInr: { type: Number, default: null }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId : { type: String, required: true, ref: 'user'} ,
    items: [orderItemSchema],
    amount : { type: Number, required: true, default: 0 },
    amountInr: { type: Number, required: true, default: 0 },
    originalTotalInr: { type: Number, required: true, default: 0 },
    subTotalInr: { type: Number, required: true, default: 0 },
    gstInr: { type: Number, required: true, default: 0 },
    shippingInr: { type: Number, required: true, default: 0 },
    discountInr: { type: Number, required: true, default: 0 },
    paymentDiscountInr: { type: Number, required: true, default: 0 },
    promoCode: { type: String, default: '' },
    paymentMethod: { type: String, default: 'COD' },
    address : { type: String, ref: 'address', required: true },
    status : { type: String, required: true, default: 'Confirmed' },
    statusTimeline: [{
        status: { type: String },
        timestamp: { type: Date, default: Date.now },
        message: { type: String }
    }],
    estimatedDeliveryDate: { type: Date },
    date: { type: Number, required: true},
    shippedAt: { type: Date },
    canceledAt: { type: Date },
    refundRequestedAt: { type: Date },
    refundCompletedAt: { type: Date },
    deliveredAt: { type: Date },
    orderEmailSentAt: { type: Date },
    cancelEmailSentAt: { type: Date },
    deliveryEmailSentAt: { type: Date },
    returnConfirmedEmailSentAt: { type: Date },
    returnEmailSentAt: { type: Date },
    refundEmailSentAt: { type: Date },
    stockRestored: { type: Boolean, default: false }
})

orderSchema.pre('validate', function(next) {
    if (Array.isArray(this.items)) {
        this.items.forEach((item) => {
            if (!item) return;

            const resolvedProductId = resolveOrderProductId(item);
            if (!resolvedProductId) return;

            item.product = resolvedProductId;
            item.productId = resolvedProductId;
        });
    }

    next();
});

const Order = mongoose.models.order || mongoose.model('order' , orderSchema)

export default Order
