import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    userId: { type: String, required: true},
    fullName: { type: String, required: true},
    phoneNumber: {
        type: String,
        required: true,
        validate: {
            validator(value) {
                return /^\d{10}$/.test(String(value || ''));
            },
            message: 'Phone number must be exactly 10 digits.'
        }
    },
    pincode: {
        type: Number,
        required: true,
        min: 100000,
        max: 999999,
        validate: {
            validator(value) {
                return /^\d{6}$/.test(String(value || ''));
            },
            message: 'Pincode must be exactly 6 digits.'
        }
    },
    area: { type: String, required: true},
    city: { type: String, required: true},
    state: { type: String, required: true},
})

const Address = mongoose.models.address || mongoose.model('address',addressSchema)

export default Address
