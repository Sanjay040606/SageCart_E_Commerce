'use client';
import { useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import { ORDER_STATUSES, getOrderMilestones } from "@/lib/orderLifecycle";
import Footer from "@/components/seller/Footer";
import Loading from "@/components/Loading";
import axios from "axios";
import toast from "react-hot-toast";

const Orders = () => {

    const router = useRouter();
    const { currency, getToken, user } = useAppContext();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [animationReady, setAnimationReady] = useState(false);

    const getOrderProgressPercent = (status) => {
        const steps = [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.SHIPPED, ORDER_STATUSES.OUT_FOR_DELIVERY, ORDER_STATUSES.DELIVERED];
        const idx = steps.indexOf(status);
        if (idx < 0) return 0;
        return ((idx + 1) / steps.length) * 100;
    }

    useEffect(() => {
        if (!loading && orders.length > 0) {
            const timer = setTimeout(() => setAnimationReady(true), 100);
            return () => clearTimeout(timer);
        }
        setAnimationReady(false);
    }, [loading, orders.length]);
    const fetchSellerOrders = async () => {
        try {
            
            const token = await getToken()

            const {data} = await axios.get('/api/order/seller-orders',{headers: {Authorization: `Bearer ${token}`}})

            if (data.success) {
                setOrders(data.orders)
                setLoading(false)
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        if (user) {
            fetchSellerOrders();
        }
    }, [user]);

    return (
        <div className="flex-1 h-screen overflow-scroll flex flex-col justify-between text-sm">
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading your orders...</p>
                    </div>
                </div>
            ) : (
                <div className="md:p-10 p-4 space-y-5">
                    <h2 className="text-lg font-medium">Orders</h2>

                    {orders.length === 0 ? (
                        <div className="rounded-md border border-gray-300 p-8 text-center text-gray-500">
                            <p className="text-base font-medium">No orders yet</p>
                            <p>Add products and get first order information here.</p>
                        </div>
                    ) : (
                        <div className="max-w-5xl border-t border-gray-300 text-sm">
                            {orders.map((order, index) => (
                                <div
                                    key={index}
                                    onClick={() => router.push(`/order/${order._id}`)}
                                    className="flex flex-col md:flex-row gap-5 justify-between p-5 border-b border-gray-300 cursor-pointer hover:bg-gray-50 transition"
                                >
                                    <div className="flex-1 flex items-center gap-5">
                                        <div className='w-16 h-16 rounded-lg overflow-hidden border border-gray-200'>
                                            <Image
                                                className='w-full h-full object-cover'
                                                src={order.items?.[0]?.product?.image?.[0] || assets.box_icon}
                                                alt={order.items?.[0]?.product?.name || 'Product'}
                                                width={64}
                                                height={64}
                                            />
                                        </div>
                                        <div>
                                            <p className='text-sm font-semibold'>Order ID: {order._id}</p>
                                            <p className='text-xs text-gray-500'>Order Date: {new Date(order.date).toLocaleDateString()}</p>
                                            <p className='text-xs text-gray-500'>Total: {formatPrice(order.amountInr ? order.amountInr : convertUSDToINR(order.amount), currency)}</p>
                                        </div>
                                    </div>
                                    <div className='flex-1'>
                                      <div className='h-2 rounded-full bg-gray-200 overflow-hidden mb-1'>
                                          <div
                                            className='h-full bg-green-500'
                                            style={{
                                              width: `${animationReady ? getOrderProgressPercent(order.status || 'Confirmed') : 0}%`,
                                              transition: 'width 900ms ease-in-out'
                                            }}
                                          />
                                      </div>
                                      <p className='text-sm font-semibold text-gray-700'>Status: {order.status || ORDER_STATUSES.CONFIRMED}</p>
                                      <p className='text-xs text-gray-500'>Delivery ETA: {new Date(order.estimatedDeliveryDate || getOrderMilestones(order).deliveryEta).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <div className='flex flex-col justify-center'>
                                        <span className='text-xs'>{order.paymentMethod === 'COD' ? 'Pending' : 'Paid'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <Footer />
        </div>
    );
};

export default Orders;
