import connectDB from "@/config/db";
import User from "@/models/User";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getWeightedReward, normalizePromoCode } from "@/lib/promoCodes";

const buildUniqueCode = async (baseCode) => {
    let code = "";
    let exists = true;

    while (exists) {
        const randomBlock = Math.random().toString(36).slice(2, 8).toUpperCase();
        code = `${baseCode}-${randomBlock}`;
        exists = await User.exists({ "gameCoupons.code": code });
    }

    return code;
};

export async function POST(request) {
    try {
        const { userId } = getAuth(request);
        if (!userId) {
            return NextResponse.json({ success: false, message: "Please log in to claim a game coupon." }, { status: 401 });
        }

        await connectDB();
        const user = await User.findById(userId);

        if (!user) {
            return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
        }

        // Get a weighted random reward instead of specific code
        const reward = getWeightedReward();
        const baseCode = reward.key;
        const code = await buildUniqueCode(baseCode);
        
        const coupon = {
            code,
            baseCode,
            rewardType: reward.type,
            rewardValue: reward.value,
            rewardLabel: reward.label,
            wonAt: new Date(),
            usedAt: null
        };

        user.gameCoupons = [...(user.gameCoupons || []), coupon].slice(-50);
        await user.save();

        return NextResponse.json({ success: true, coupon });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
