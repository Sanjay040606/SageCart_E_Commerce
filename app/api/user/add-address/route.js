import connectDB from "@/config/db";
import Address from "@/models/Address";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { handleDatabaseError } from "@/lib/errorHandler";

const keepDigits = (value, maxLength) => String(value ?? "").replace(/\D/g, "").slice(0, maxLength);
const cleanText = (value) => String(value ?? "").trim();

export async function POST(request) {
    try {
        
        const { userId } = getAuth(request)
        const { address } = await request.json()

        if (!userId) {
            return NextResponse.json({ success: false, message: "Unauthorized. Please log in again." }, { status: 401 });
        }

        await connectDB()
        
        const sanitizedPhoneNumber = keepDigits(address?.phoneNumber, 10);
        const sanitizedPincode = keepDigits(address?.pincode, 6);

        if (sanitizedPhoneNumber.length !== 10) {
            return NextResponse.json({ success: false, message: "Phone number must be exactly 10 digits." }, { status: 400 });
        }

        if (sanitizedPincode.length !== 6) {
            return NextResponse.json({ success: false, message: "Pincode must be exactly 6 digits." }, { status: 400 });
        }

        const sanitisedAddress = {
            fullName: cleanText(address?.fullName),
            userId,
            phoneNumber: sanitizedPhoneNumber,
            pincode: Number(sanitizedPincode),
            area: cleanText(address?.area),
            city: cleanText(address?.city),
            state: cleanText(address?.state)
        }

        const newAddress = await Address.create(sanitisedAddress)

        return NextResponse.json({ success: true, message: "Address added successfully", newAddress})

    } catch (error) {
        console.error('Address Creation Error:', error)
        return NextResponse.json({ success: false, message: handleDatabaseError(error) }, { status: 400 });
    }
}
