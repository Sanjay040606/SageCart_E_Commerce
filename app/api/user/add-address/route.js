import connectDB from "@/config/db";
import Address from "@/models/Address";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { handleDatabaseError } from "@/lib/errorHandler";


export async function POST(request) {
    try {
        
        const { userId } = getAuth(request)
        const { address } = await request.json()

        if (!userId) {
            return NextResponse.json({ success: false, message: "Unauthorized. Please log in again." }, { status: 401 });
        }

        await connectDB()
        
        // Ensure pincode is a number for Mongoose validation
        const sanitisedAddress = {
            ...address,
            userId,
            pincode: Number(address.pincode)
        }

        const newAddress = await Address.create(sanitisedAddress)

        return NextResponse.json({ success: true, message: "Address added successfully", newAddress})

    } catch (error) {
        console.error('Address Creation Error:', error)
        return NextResponse.json({ success: false, message: handleDatabaseError(error) }, { status: 400 });
    }
}