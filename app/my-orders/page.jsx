'use client';
import { useCallback, useEffect, useRef, useState } from "react";
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
    getOrderPaymentStateClass,
    getOrderPaymentStateLabel,
    getPrimaryOrderProductLabel,
    getOrderSummaryStatusClass,
    getOrderSummaryStatusLabel
} from "@/lib/orderDisplay";
import {
    ORDER_STATUSES,
    REFUND_DELAY_HOURS,
    canRequestReturn,
    getOrderMilestones,
    getReturnMilestones,
    getStatusTimestamp,
    getTimelineEntry,
    hasCanceledFlow,
    hasReturnFlow,
    isPrepaidOrder
} from "@/lib/orderLifecycle";
import { getProductPrimaryImage, normalizeProductImageUrl } from "@/lib/productDisplay";

const ORDERS_PAGE_SIZE = 20;

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
    const [refreshing, setRefreshing] = useState(false);
    const [animationReady, setAnimationReady] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({
        totalOrders: 0,
        totalPages: 1
    });
    const hasFetchedOnceRef = useRef(false);

    const getDisplayStatus = (order) => order?.status || ORDER_STATUSES.CONFIRMED
    const getTimelineDate = (order, status) => getTimelineEntry(order, status)?.timestamp || null

    const getOrderSecondaryText = (order) => {
        const { shippedEta, deliveryEta } = getOrderMilestones(order)
        const returnMilestones = getReturnMilestones(order)
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
            if (order.status === ORDER_STATUSES.RETURNED) {
                return isPrepaidOrder(order)
                    ? `Returned on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURNED))}. Refund processing until ${formatStatusDate(returnMilestones?.refundCompletedEta)}.`
                    : `Returned on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURNED))}`
            }
            if (order.status === ORDER_STATUSES.OUT_FOR_PICKUP) {
                return `Next process: pickup scheduled for ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.OUT_FOR_PICKUP) || returnMilestones?.outForPickupEta)}`
            }
            if (order.status === ORDER_STATUSES.RETURN_CONFIRMED) {
                return `Next process: pickup on ${formatStatusDate(returnMilestones?.outForPickupEta)} after return confirmation on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURN_CONFIRMED))}.`
            }
            if (getTimelineDate(order, ORDER_STATUSES.RETURNED)) {
                return `Returned on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURNED))}. Refund processing next.`
            }
            return `Return confirmed on ${formatStatusDate(getTimelineDate(order, ORDER_STATUSES.RETURN_CONFIRMED))}.`
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

    const fetchOrders = useCallback(async ({ initial = false, page = 1 } = {}) => {
        try {
            if (initial) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const token = await getToken()

            const {data} = await axios.get(`/api/order/list?page=${page}&limit=${ORDERS_PAGE_SIZE}`, {headers: {Authorization: `Bearer ${token}`}})

            if (data.success) {
                setOrders(Array.isArray(data.orders) ? data.orders : [])
                setPagination({
                    totalOrders: data.pagination?.totalOrders || 0,
                    totalPages: data.pagination?.totalPages || 1
                })
                if (typeof data.pagination?.page === 'number' && data.pagination.page !== page) {
                    setCurrentPage(data.pagination.page)
                }
            } else {
                toast.error(data.message)
                setOrders([])
            }

        } catch (error) {
            toast.error(error?.response?.data?.message || error.message)
            setOrders([])
        } finally {
            hasFetchedOnceRef.current = true
            if (initial) {
                setLoading(false)
            } else {
                setRefreshing(false)
            }
        }
    }, [getToken])

    useEffect(() => {
        if (user) {
            fetchOrders({
                initial: !hasFetchedOnceRef.current && currentPage === 1,
                page: currentPage
            });
        } else {
            setLoading(false);
        }
    }, [currentPage, fetchOrders, user]);

    useEffect(() => {
        if (!loading && orders.length > 0) {
            const timer = setTimeout(() => setAnimationReady(true), 100);
            return () => clearTimeout(timer);
        }
        setAnimationReady(false);
    }, [loading, orders.length]);

    const visibleStart = pagination.totalOrders > 0 ? ((currentPage - 1) * ORDERS_PAGE_SIZE) + 1 : 0;
    const visibleEnd = pagination.totalOrders > 0
        ? Math.min(currentPage * ORDERS_PAGE_SIZE, pagination.totalOrders)
        : 0;

    return (
        <>
            <Navbar />
            <div className="flex flex-col justify-between px-6 md:px-16 lg:px-32 py-6 min-h-screen">
                <div className="space-y-5">
                    <h2 className="text-lg font-medium mt-6">My Orders</h2>
                    {!loading && (
                        <p className="text-xs text-gray-500">
                            {refreshing ? 'Refreshing this page...' : 'Showing a page of your order history'}
                        </p>
                    )}

                    {loading ? <Loading /> : orders.length === 0 ? (
                        <div className="brand-surface rounded-[1.5rem] p-8 text-center text-[var(--ink-500)]">
                            <p className="text-lg font-semibold text-[var(--ink-900)] mb-2">No orders found</p>
                            <p className="text-sm">Place a test order and it will appear here.</p>
                        </div>
                    ) : (<div className="max-w-5xl border-t border-gray-300 text-sm">
                        {orders.map((order) => {
                            const productLabel = getPrimaryOrderProductLabel(order)
                            const statusLabel = getOrderSummaryStatusLabel(order)
                            const paymentState = getOrderPaymentStateLabel(order)
                            const firstItem = order.items?.[0] || {}
                            const productSource = firstItem.product && typeof firstItem.product === 'object' ? firstItem.product : firstItem
                            const productImage = normalizeProductImageUrl(firstItem.productImage || getProductPrimaryImage(productSource))
                            const variantLabel = firstItem.variantLabel || firstItem.color || ""
                            const productAlt = productSource?.name || firstItem.productName || 'Product'

                            return (
                                <div
                                  key={order._id}
                                  onClick={() => router.push(`/order/${order._id}`)}
                                  className="flex flex-col md:flex-row gap-5 justify-between p-5 border-b border-gray-300 cursor-pointer hover:bg-gray-50 transition"
                                >
                                    <div className="flex-1 flex items-center gap-5">
                                        <div className='w-16 h-16 rounded-lg overflow-hidden border border-gray-200'>
                                                <Image
                                                    className='w-full h-full object-cover'
                                                    src={productImage || assets.box_icon}
                                                    alt={productAlt}
                                                    width={64}
                                                    height={64}
                                                />
                                        </div>
                                        <div>
                                            <p className='text-sm font-semibold'>{productLabel}</p>
                                            <p className='text-xs text-gray-500'>Order Date: {new Date(order.date).toLocaleDateString()}</p>
                                            <p className='text-xs text-gray-500'>Total: {formatPrice(order.amountInr ? order.amountInr : convertUSDToINR(order.amount), currency)}</p>
                                            {variantLabel && <p className='text-xs text-gray-500'>Variant: {variantLabel}</p>}
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
                                        <p className={`text-sm font-semibold ${getOrderSummaryStatusClass(order)}`}>
                                            {statusLabel}
                                        </p>
                                        <p className='text-xs text-gray-500'>
                                            {getOrderSecondaryText(order)}
                                        </p>
                                    </div>
                                    <div className='flex flex-col justify-center'>
                                        <span className={`text-xs ${getOrderPaymentStateClass(order)}`}>
                                            {paymentState}
                                        </span>
                                    </div>
                                </div>
                            )
                            })}
                        </div>)}

                    {!loading && orders.length > 0 && (
                        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                                Showing {visibleStart}-{visibleEnd} of {pagination.totalOrders} orders
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={loading || refreshing || currentPage <= 1}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="min-w-24 text-center text-xs text-gray-500">
                                    Page {currentPage} of {pagination.totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}
                                    disabled={loading || refreshing || currentPage >= pagination.totalPages}
                                    className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

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




