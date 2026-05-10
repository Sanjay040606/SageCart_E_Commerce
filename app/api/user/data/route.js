import connectDB from "@/config/db";
import User from "@/models/User";
import { normalizeSupportHistoryEntries } from "@/lib/supportHistory";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const syncUserFromClerk = async (userId) => {
    if (!userId) return null;

    let user = await User.findById(userId);
    if (user) return user;

    try {
        const clerkRef = await clerkClient();
        const clerkUser = await clerkRef.users.getUser(userId);
        if (clerkUser) {
            const userData = {
                _id: userId,
                email: clerkUser.emailAddresses[0].emailAddress,
                name: clerkUser.firstName + ' ' + clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
            }
            await User.create(userData);
            user = await User.findById(userId);
        }
    } catch (syncError) {
        console.log('Failed to fallback sync user', syncError)
    }

    return user;
};

export async function GET(request) {
    try {
        const { userId } = getAuth(request)
        await connectDB()
        const user = await syncUserFromClerk(userId)

        if (!user) {
            return NextResponse.json({ success: false, message: "User Not Found"})
        }

        return NextResponse.json({success:true, user})

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message})
    }
}

export async function PATCH(request) {
    try {
        const { userId } = getAuth(request)
        await connectDB()
        const user = await syncUserFromClerk(userId)

        if (!user) {
            return NextResponse.json({ success: false, message: "User Not Found" })
        }

        const body = await request.json().catch(() => ({}))
        if (Array.isArray(body.supportQueryHistory)) {
            user.supportQueryHistory = normalizeSupportHistoryEntries(body.supportQueryHistory)
            user.supportQueryHistoryUpdatedAt = new Date()
            await user.save()
        }

        return NextResponse.json({ success: true, user })
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message })
    }
}
