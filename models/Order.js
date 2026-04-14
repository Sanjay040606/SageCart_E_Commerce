import mongoose from "mongoose";
import Address from './Address.js';

const orderSchema = new mongoose.Schema({
    userId : { type: String, required: true, ref: 'user'} ,
    items: [{
        product: { type: String, required: true, ref: 'product' },
        quantity : { type: Number, required: true }
    }],
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
    refundEmailSentAt: { type: Date },
    stockRestored: { type: Boolean, default: false }
})

const Order = mongoose.models.order || mongoose.model('order' , orderSchema)

export default Order
