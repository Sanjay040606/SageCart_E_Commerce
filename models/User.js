import mongoose from "mongoose";

const supportHistoryTimelineSchema = new mongoose.Schema({
    label: { type: String, default: '' },
    date: { type: String, default: null },
    note: { type: String, default: '' }
}, { _id: false });

const supportHistoryItemSchema = new mongoose.Schema({
    id: { type: String, default: '' },
    action: { type: String, default: '' },
    orderId: { type: String, default: '' },
    orderShortId: { type: String, default: '' },
    productName: { type: String, default: '' },
    orderStatus: { type: String, default: '' },
    paymentState: { type: String, default: '' },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    timeline: { type: [supportHistoryTimelineSchema], default: [] },
    status: { type: String, default: 'open' },
    createdAt: { type: String, default: null },
    updatedAt: { type: String, default: null },
    resolvedAt: { type: String, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema({
    _id:{ type : String, required:true },
    name:{ type : String, required:true },
    email:{ type : String, required:true , unique:true },
    imageUrl : { type : String, required:true },
    cartItems: { type:Object, default: {} },
    wishlistItems: { type: [String], default: [] },
    gameCoupons: [{
        code: { type: String, uppercase: true, trim: true },
        baseCode: { type: String, uppercase: true, trim: true },
        rewardType: { type: String },
        rewardValue: { type: mongoose.Schema.Types.Mixed },
        wonAt: { type: Date, default: Date.now },
        usedAt: { type: Date, default: null }
    }],
    supportQueryHistory: { type: [supportHistoryItemSchema], default: [] },
    supportQueryHistoryUpdatedAt: { type: Date },
    welcomeEmailSentAt: { type: Date }
}, { minimize: false })

const User = mongoose.models.user || mongoose.model('user',userSchema)

export default User
