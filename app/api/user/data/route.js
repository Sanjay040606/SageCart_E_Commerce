import connectDB from "@/config/db";
import User from "@/models/User";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(request) {
    try {
        const { userId } = getAuth(request)
        await connectDB()
        let user = await User.findById(userId)

        if (!user) {
            // Attempt fallback sync for existing Clerk users when Inngest dev server is off locally
            try {
                const clerkRef = await clerkClient()
                const clerkUser = await clerkRef.users.getUser(userId)
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
        }

        if (!user) {
            return NextResponse.json({ success: false, message: "User Not Found"})
        }

        return NextResponse.json({success:true, user})

    } catch (error) {
        return NextResponse.json({ success: false, message: error.message})
    }
}