import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    _id:{ type : String, required:true },
    name:{ type : String, required:true },
    email:{ type : String, required:true , unique:true },
    imageUrl : { type : String, required:true },
    cartItems: { type:Object, default: {} },
    gameCoupons: [{
        code: { type: String, uppercase: true, trim: true },
        baseCode: { type: String, uppercase: true, trim: true },
        rewardType: { type: String },
        rewardValue: { type: mongoose.Schema.Types.Mixed },
        wonAt: { type: Date, default: Date.now },
        usedAt: { type: Date, default: null }
    }],
    welcomeEmailSentAt: { type: Date }
}, { minimize: false })

const User = mongoose.models.user || mongoose.model('user',userSchema)

export default User
