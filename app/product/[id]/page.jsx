"use client"
import { useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import ProductCard from "@/components/ProductCard";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import { useParams } from "next/navigation";
import Loading from "@/components/Loading";
import { useAppContext } from "@/context/AppContext";
import { useClerk } from "@clerk/nextjs";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import toast from 'react-hot-toast'
import React from "react";

const Product = () => {

    const { id } = useParams();

    const { products, router, addToCart, currency, user } = useAppContext()
    const { openSignIn } = useClerk()

    const [mainImage, setMainImage] = useState(null);
    const [productData, setProductData] = useState(null);

    const fetchProductData = async () => {
        const product = products.find(product => product._id === id);
        setProductData(product);
    }

    const getStatusDisplay = (status, stock) => {
        switch (status) {
            case 'out_of_stock':
                return { text: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-50' }
            case 'low_stock':
                return { text: `Only ${stock} left in stock`, color: 'text-[var(--accent-strong)]', bgColor: 'bg-[var(--accent-tint)]' }
            case 'inactive':
                return { text: 'Currently Unavailable', color: 'text-gray-600', bgColor: 'bg-gray-50' }
            default:
                return null
        }
    }

    const statusInfo = productData ? getStatusDisplay(productData.status, productData.stock) : null
    const isAvailable = productData && (productData.status === 'active' || productData.status === 'low_stock')

    useEffect(() => {
        fetchProductData();
    }, [id, products.length])

    return productData ? (<>
        <Navbar />
        <div className="px-6 md:px-16 lg:px-32 pt-14 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="px-5 lg:px-16 xl:px-20">
                    <div className="rounded-lg overflow-hidden bg-gray-500/10 mb-4">
                        <Image
                            src={mainImage || productData.image[0]}
                            alt="alt"
                            className="w-full h-auto object-cover mix-blend-multiply"
                            width={1280}
                            height={720}
                        />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        {productData.image.map((image, index) => (
                            <div
                                key={index}
                                onClick={() => setMainImage(image)}
                                className="cursor-pointer rounded-lg overflow-hidden bg-gray-500/10"
                            >
                                <Image
                                    src={image}
                                    alt="alt"
                                    className="w-full h-auto object-cover mix-blend-multiply"
                                    width={1280}
                                    height={720}
                                />
                            </div>

                        ))}
                    </div>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-3xl font-medium text-gray-800/90 mb-4">
                        {productData.name}
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                            <Image className="h-4 w-4" src={assets.star_icon} alt="star_icon" />
                            <Image className="h-4 w-4" src={assets.star_icon} alt="star_icon" />
                            <Image className="h-4 w-4" src={assets.star_icon} alt="star_icon" />
                            <Image className="h-4 w-4" src={assets.star_icon} alt="star_icon" />
                            <Image
                                className="h-4 w-4"
                                src={assets.star_dull_icon}
                                alt="star_dull_icon"
                            />
                        </div>
                        <p>(4.5)</p>
                    </div>
                    <p className="text-gray-600 mt-3">
                        {productData.description}
                    </p>

                    {statusInfo && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor} mt-4`}>
                            {statusInfo.text}
                        </div>
                    )}

                    <p className="text-3xl font-medium mt-6">
                        {formatPrice(convertUSDToINR(productData.offerPrice), currency)}
                        <span className="text-base font-normal text-gray-800/60 line-through ml-2">
                            {formatPrice(convertUSDToINR(productData.price), currency)}
                        </span>
                    </p>
                    <hr className="bg-gray-600 my-6" />
                    <div className="overflow-x-auto">
                        <table className="table-auto border-collapse w-full max-w-72">
                            <tbody>
                                <tr>
                                    <td className="text-gray-600 font-medium">Brand</td>
                                    <td className="text-gray-800/50 ">Generic</td>
                                </tr>
                                <tr>
                                    <td className="text-gray-600 font-medium">Color</td>
                                    <td className="text-gray-800/50 ">Multi</td>
                                </tr>
                                <tr>
                                    <td className="text-gray-600 font-medium">Category</td>
                                    <td className="text-gray-800/50">
                                        {productData.category}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-gray-50 border border-[var(--line-soft)] rounded p-3 mt-5">
                        <p className="text-sm font-semibold">Product Promo Code</p>
                        <p className="text-gray-700">{productData.promoCode || 'No promo code available'}</p>
                        <p className="text-xs text-gray-500 mt-1">Use this code at checkout for 10% off this product plus free shipping</p>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded p-3 mt-3">
                        <p className="text-sm font-semibold text-green-800">💳 Payment Discount Offer</p>
                        <p className="text-green-700">Get ₹60 off when you pay using UPI or Card!</p>
                        <p className="text-xs text-green-600 mt-1">Available at checkout for all products</p>
                    </div>
                    <div className="flex items-center mt-4 gap-4">
                        <button
                            onClick={() => addToCart(productData._id)}
                            disabled={!isAvailable}
                            className={`w-full py-3.5 text-gray-800/80 transition ${
                                isAvailable
                                    ? 'bg-gray-100 hover:bg-gray-200'
                                    : 'bg-gray-200 cursor-not-allowed opacity-50'
                            }`}
                        >
                            {isAvailable ? 'Add to Cart' : 'Out of Stock'}
                        </button>
                        <button
                            onClick={() => {
                                if (!user) {
                                    toast.error('Please log in to buy this product.');
                                    openSignIn();
                                    return;
                                }
                                if (!isAvailable) {
                                    toast.error('This product is currently unavailable.');
                                    return;
                                }
                                addToCart(productData._id);
                                router.push('/cart');
                            }}
                            disabled={!isAvailable}
                            className={`brand-button w-full py-3.5 transition ${
                                isAvailable
                                    ? ''
                                    : 'opacity-50 cursor-not-allowed'
                            }`}
                        >
                            {isAvailable ? 'Buy now' : 'Unavailable'}
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-center">
                <div className="flex flex-col items-center mb-4 mt-16">
                    <p className="text-3xl font-medium">Featured <span className="font-medium text-[var(--accent-strong)]">Products</span></p>
                    <div className="w-28 h-0.5 bg-[var(--accent)] mt-2"></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6 pb-14 w-full">
                    {products.slice(0, 5).map((product, index) => <ProductCard key={index} product={product} />)}
                </div>
                <button className="px-8 py-2 mb-16 border rounded text-gray-500/70 hover:bg-slate-50/90 transition">
                    See more
                </button>
            </div>
        </div>
        <Footer />
    </>
    ) : <Loading />
};

export default Product;