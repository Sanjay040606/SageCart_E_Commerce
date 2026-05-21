import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
    source: { type: String, default: "manual" },
    sourceId: { type: String, sparse: true, unique: true, trim: true },
    userId: { type: String, required: true, ref: "user" },
    name: { type: String, required: true},
    brand: { type: String, default: "" },
    description: { type: String, required: true},
    price: { type: Number, required: true},
    offerPrice: { type: Number, required: true},
    image: { type: Array, required: true},
    category: { type: String, required: true},
    promoCode: {
        type: String,
        sparse: true,
        unique: true,
        set: (value) => {
            const text = String(value ?? "").trim().toUpperCase();
            return text || undefined;
        }
    },
    stock: { type: Number, default: 0, min: 0 },
    status: {
        type: String,
        enum: ['active', 'inactive', 'out_of_stock', 'low_stock'],
        default: 'active'
    },
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    variantMode: { type: String, default: 'variant' },
    variantOptions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    reviews: [reviewSchema],
    date: {type: Number , required: true},
    datasetMeta: { type: mongoose.Schema.Types.Mixed, default: {} }
})

const Product = mongoose.models.product || mongoose.model('product' , productSchema)

export default Product
