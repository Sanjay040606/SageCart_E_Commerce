'use client';
import { useCallback, useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import Loading from "@/components/Loading";
import Chatbot from "@/components/Chatbot";
import axios from "axios";
import toast from "react-hot-toast";
import {
    ORDER_STATUSES,
    REFUND_DELAY_HOURS,
    canRequestReturn,
    getOrderMilestones,
    getStatusTimestamp,
    getTimelineEntry,
    hasCanceledFlow,
    hasReturnFlow,
    isPrepaidOrder
} from "@/lib/orderLifecycle";

const formatStatusDate = (value) => {
    if (!value) return 'Not yet'

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'Not yet'

    return parsed.toLocaleDateString('en-GB')
}

const MyOrders = () => {

    const router = useRouter();
    const { currency, getToken, user } = useAppContext();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [animationReady, setAnimationReady] = useState(false);

    const getDisplayStatus = (order) => order?.status || ORDER_STATUSES.CONFIRMED

    const getTimelineDate = (order, status) => getTimelineEntry(order, status)?.timestamp || null

    const getOrderPaymentState = (order) => {
        if (hasCanceledFlow(order)) {
            return isPrepaidOrder(order)
                ? (order.status === ORDER_STATUSES.REFUNDED ? 'Refunded' : 'Refund processing')
                : 'Order canceled'
        }

        if (hasReturnFlow(order)) {
            return order.status === ORDER_STATUSES.REFUNDED ? 'Refunded' : 'Return in progress'
        }

        if (canRequestReturn(order)) return 'Return available'
        return order.paymentMethod === 'COD' ? 'Pending' : 'Paid'
    }

    const getOrderSecondaryText = (order) => {
        const { shippedEta, deliveryEta } = getOrderMilestones(order)
        const deliveredAt = order.deliveredAt || getTimelineDate(order, ORDER_STATUSES.DELIVERED)
        const canceledAt = getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order.canceledAt)
        const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order.refundRequestedAt)
        const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order.refundCompletedAt)

        if (hasCanceledFlow(order) && isPrepaidOrder(order)) {
            if (order.status === ORDER_STATUSES.REFUNDED) {
                return `Canceled on ${formatStatusDate(canceledAt)}. Refund completed on ${formatStatusDate(refundedAt)}`
            }
            return `Canceled on ${formatStatusDate(canceledAt)}. Refund initiated on ${formatStatusDate(refundInitiatedAt)}. Refund completes in about ${REFUND_DELAY_HOURS} hours.`
        }

        if (hasCanceledFlow(order)) {
            return `Canceled on ${formatStatusDate(canceledAt)}`
        }

        if (hasReturnFlow(order)) {
            if (order.status === ORDER_STATUSES.REFUNDED) {
                return `Return refunded on ${formatStatusDate(order.refundCompletedAt || getTimelineDate(order, ORDER_STATUSES.REFUNDED))}`
            }
            if (getTimelineDate(order, ORDER_STATUSES.RETURNED)) {
                return `Returned on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURNED))}`
            }
            if (getTimelineDate(order, ORDER_STATUSES.OUT_FOR_PICKUP)) {
                return `Pickup on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.OUT_FOR_PICKUP))}`
            }
            return `Return confirmed on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURN_CONFIRMED))}`
        }

        if (order.status === ORDER_STATUSES.DELIVERED) {
            return `Delivered on ${formatStatusDate(deliveredAt)}`
        }

        if (order.status === ORDER_STATUSES.SHIPPED) {
            return `Shipped on ${formatStatusDate(order.shippedAt || shippedEta)}`
        }

        return `Shipment ETA ${formatStatusDate(shippedEta)}. Delivery ETA ${formatStatusDate(deliveryEta)}`
    }

    const getOrderProgressPercent = (order) => {
        const status = getDisplayStatus(order)

        if (status === ORDER_STATUSES.CANCELED) return 100
        if (status === ORDER_STATUSES.REFUND_INITIATED) return 75
        if (status === ORDER_STATUSES.REFUNDED) return 100
        if (status === ORDER_STATUSES.RETURN_CONFIRMED) return 76
        if (status === ORDER_STATUSES.OUT_FOR_PICKUP) return 84
        if (status === ORDER_STATUSES.RETURNED) return 92

        const steps = ['Confirmed', 'Shipped', 'Out for Delivery', 'Delivered']
        const idx = steps.indexOf(status)
        if (idx < 0) return 0
        return ((idx + 1) / steps.length) * 100
    }

    const fetchOrders = useCallback(async () => {
        try {
            
            const token = await getToken()

            const {data} = await axios.get('/api/order/list', {headers: {Authorization: `Bearer ${token}`}})

            if (data.success) {
                setOrders((data.orders || []).reverse())
            } else {
                toast.error(data.message)
                setOrders([])
            }

        } catch (error) {
            toast.error(error?.response?.data?.message || error.message)
            setOrders([])
        } finally {
            setLoading(false)
        }
    }, [getToken])

    useEffect(() => {
        if (user) {
            fetchOrders();
        }
    }, [fetchOrders, user]);

    useEffect(() => {
        if (!loading && orders.length > 0) {
            const timer = setTimeout(() => setAnimationReady(true), 100);
            return () => clearTimeout(timer);
        }
        setAnimationReady(false);
    }, [loading, orders.length]);

    return (
        <>
            <Navbar />
            <div className="flex flex-col justify-between px-6 md:px-16 lg:px-32 py-6 min-h-screen">
                <div className="space-y-5">
                    <h2 className="text-lg font-medium mt-6">My Orders</h2>

                    {loading ? <Loading /> : orders.length === 0 ? (
                        <div className="brand-surface rounded-[1.5rem] p-8 text-center text-[var(--ink-500)]">
                            <p className="text-lg font-semibold text-[var(--ink-900)] mb-2">No orders found</p>
                            <p className="text-sm">Place a test order and it will appear here.</p>
                        </div>
                    ) : (<div className="max-w-5xl border-t border-gray-300 text-sm">
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
                                                                                width: `${animationReady ? getOrderProgressPercent(order) : 0}%`,
                                                                                transition: [ORDER_STATUSES.CANCELED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.RETURNED].includes(order.status) ? 'none' : 'width 900ms ease-in-out'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <p className='text-sm font-semibold text-gray-700'>
                                                                        {hasCanceledFlow(order) && isPrepaidOrder(order) && order.status === ORDER_STATUSES.REFUNDED ? 'Canceled and Refunded' :
                                                                          hasCanceledFlow(order) && isPrepaidOrder(order) ? 'Refund Initiated' :
                                                                          hasCanceledFlow(order) ? 'Order Canceled' :
                                                                          hasReturnFlow(order) && order.status === ORDER_STATUSES.REFUNDED ? 'Return Refunded' :
                                                                          order.status === ORDER_STATUSES.RETURNED ? 'Returned' :
                                                                          getDisplayStatus(order)
                                                                        }
                                                                    </p>
                                                                    <p className='text-xs text-gray-500'>
                                                                        {getOrderSecondaryText(order)}
                                                                    </p>
                                </div>
                                <div className='flex flex-col justify-center'>
                                    <span className='text-xs'>
                                        {getOrderPaymentState(order)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>)}

                    <div className='bg-white p-6 rounded-lg shadow-sm mt-6'>
                      <h3 className='text-lg font-semibold mb-3'>Need Help?</h3>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                        {[
                          'How do I track my order?',
                          'Can I cancel an order?',
                          'What is return policy?',
                          'Payment refund status?'
                        ].map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => router.push(`/help?q=${encodeURIComponent(q)}`)}
                            className='text-xs text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-[var(--accent-tint)]'
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                </div>
            </div>
            <Chatbot pageContext="my-orders" />
            <Footer />
        </>
    );
};

export default MyOrders;




