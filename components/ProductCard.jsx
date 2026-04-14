import React from 'react'
import { assets } from '@/assets/assets'
import Image from 'next/image';
import { useAppContext } from '@/context/AppContext';
import { convertUSDToINR, formatPrice } from '@/lib/currencyUtils';

const ProductCard = ({ product }) => {

    const { currency, router } = useAppContext()

    const getStatusDisplay = (status, stock) => {
        switch (status) {
            case 'out_of_stock':
                return { text: 'Out of Stock', color: 'text-red-600', bgColor: 'bg-red-50' }
            case 'low_stock':
                return { text: `Only ${stock} left`, color: 'text-[var(--accent-strong)]', bgColor: 'bg-[var(--accent-tint)]' }
            case 'inactive':
                return { text: 'Unavailable', color: 'text-gray-600', bgColor: 'bg-gray-50' }
            default:
                return null
        }
    }

    const statusInfo = getStatusDisplay(product.status, product.stock)
    const isAvailable = product.status === 'active' || product.status === 'low_stock'

    return (
        <div
            onClick={() => { router.push('/product/' + product._id); scrollTo(0, 0) }}
            className="flex flex-col items-start gap-0.5 max-w-[200px] w-full cursor-pointer"
        >
            <div className="cursor-pointer group relative bg-gray-500/10 rounded-lg w-full h-52 flex items-center justify-center">
                <Image
                    src={product.image[0]}
                    alt={product.name}
                    className="group-hover:scale-105 transition object-cover w-4/5 h-4/5 md:w-full md:h-full"
                    width={800}
                    height={800}
                />
                <button className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-md">
                    <Image
                        className="h-3 w-3"
                        src={assets.heart_icon}
                        alt="heart_icon"
                    />
                </button>
            </div>

            <p className="md:text-base font-medium pt-2 w-full truncate">{product.name}</p>
            <p className="w-full text-xs text-gray-500/70 max-sm:hidden truncate">{product.description}</p>

            {statusInfo && (
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor} w-full text-center`}>
                    {statusInfo.text}
                </div>
            )}

            <div className="flex items-center gap-2">
                <p className="text-xs">{4.5}</p>
                <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <Image
                            key={index}
                            className="h-3 w-3"
                            src={
                                index < Math.floor(4)
                                    ? assets.star_icon
                                    : assets.star_dull_icon
                            }
                            alt="star_icon"
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-end justify-between w-full mt-1">
                <p className="text-base font-medium">{formatPrice(convertUSDToINR(product.offerPrice), currency)}</p>
                <button
                    className={`max-sm:hidden px-4 py-1.5 text-gray-500 border border-gray-500/20 rounded-full text-xs hover:bg-slate-50 transition ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!isAvailable}
                >
                    Buy now
                </button>
            </div>
        </div>
    )
}

export default ProductCard