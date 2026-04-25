'use client'
import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import { useAppContext } from '@/context/AppContext'
import Loading from '@/components/Loading'

const Wishlist = () => {
    const { products, wishlistItems, productsLoading } = useAppContext()

    if (productsLoading) {
        return <Loading />
    }

    const wishlistedProducts = products.filter(product => wishlistItems?.includes(product._id))

    return (
        <>
            <Navbar />
            <div className="flex flex-col items-center px-6 md:px-16 lg:px-32 pt-14 min-h-[60vh]">
                <div className="flex flex-col items-center mb-8">
                    <p className="text-3xl font-medium">Your <span className="font-medium text-[var(--accent-strong)]">Wishlist</span></p>
                    <div className="w-28 h-0.5 bg-[var(--accent)] mt-2"></div>
                </div>

                {wishlistedProducts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6 pb-14 w-full">
                        {wishlistedProducts.map((product, index) => <ProductCard key={index} product={product} />)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center mt-10">
                        <p className="text-xl text-[var(--ink-500)] mb-4">Your wishlist is currently empty.</p>
                        <p className="text-[var(--ink-400)]">Explore our collection and add items you love to your wishlist.</p>
                    </div>
                )}
            </div>
            <Footer />
        </>
    )
}

export default Wishlist
