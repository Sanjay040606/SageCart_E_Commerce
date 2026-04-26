'use client';
import { useCallback, useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import { convertUSDToINR, formatPrice } from "@/lib/currencyUtils";
import {
    ORDER_STATUSES,
    getOrderMilestones,
    getStatusTimestamp,
    hasCanceledFlow,
    hasReturnFlow,
    isPrepaidOrder
} from "@/lib/orderLifecycle";
import {
    getOrderPaymentStateClass,
    getOrderPaymentStateLabel,
    getPrimaryOrderProductLabel,
    getOrderSummaryStatusClass,
    getOrderSummaryStatusLabel
} from "@/lib/orderDisplay";
import Footer from "@/components/seller/Footer";
import axios from "axios";
import toast from "react-hot-toast";

const formatStatusDate = (value) => {
    if (!value) return 'Not yet';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not yet';

    return parsed.toLocaleDateString('en-GB');
};

const Orders = () => {

    const router = useRouter();
    const { currency, getToken, user } = useAppContext();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [animationReady, setAnimationReady] = useState(false);

    const getOrderProgressPercent = (status) => {
        const steps = [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.SHIPPED, ORDER_STATUSES.OUT_FOR_DELIVERY, ORDER_STATUSES.DELIVERED];
        const idx = steps.indexOf(status);
        if (idx < 0) return 0;
        return ((idx + 1) / steps.length) * 100;
    }

    const getSellerOrderDetails = (order) => {
        const { shippedEta, deliveryEta } = getOrderMilestones(order || {});
        const canceledAt = getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order?.canceledAt);
        const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order?.refundRequestedAt);
        const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order?.refundCompletedAt);

        if (hasCanceledFlow(order) && isPrepaidOrder(order)) {
            if (order.status === ORDER_STATUSES.REFUNDED) {
                return `Canceled on ${formatStatusDate(canceledAt)}. Refund completed on ${formatStatusDate(refundedAt)}.`;
            }

            return `Canceled on ${formatStatusDate(canceledAt)}. Refund initiated on ${formatStatusDate(refundInitiatedAt)}.`;
        }

        if (hasCanceledFlow(order)) {
            return `Canceled on ${formatStatusDate(canceledAt)}.`;
        }

        if (hasReturnFlow(order)) {
            if (order.status === ORDER_STATUSES.REFUNDED) {
                return `Return refunded on ${formatStatusDate(order.refundCompletedAt || refundedAt)}.`;
            }

            return `Return in progress.`;
        }

        if (order.status === ORDER_STATUSES.DELIVERED) {
            return `Delivered on ${formatStatusDate(order.deliveredAt || deliveryEta)}.`;
        }

        if (order.status === ORDER_STATUSES.SHIPPED) {
            return `Shipped on ${formatStatusDate(order.shippedAt || shippedEta)}.`;
        }

        return `Delivery ETA: ${formatStatusDate(order.estimatedDeliveryDate || deliveryEta)}`;
    }

    const getSellerProgressPercent = (order) => {
        const status = order?.status || ORDER_STATUSES.CONFIRMED;

        if (hasCanceledFlow(order)) {
            if (status === ORDER_STATUSES.REFUND_INITIATED) return 75;
            return 100;
        }

        if (hasReturnFlow(order)) {
            if (status === ORDER_STATUSES.RETURN_CONFIRMED) return 76;
            if (status === ORDER_STATUSES.OUT_FOR_PICKUP) return 84;
            if (status === ORDER_STATUSES.RETURNED) return 92;
            if (status === ORDER_STATUSES.REFUNDED) return 100;
        }

        return getOrderProgressPercent(status);
    }

    useEffect(() => {
        if (!loading && orders.length > 0) {
            const timer = setTimeout(() => setAnimationReady(true), 100);
            return () => clearTimeout(timer);
        }
        setAnimationReady(false);
    }, [loading, orders.length]);
    const fetchSellerOrders = useCallback(async ({ initial = false, silent = false } = {}) => {
        try {
            if (initial) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const token = await getToken()

            const {data} = await axios.get('/api/order/seller-orders',{headers: {Authorization: `Bearer ${token}`}})

            if (data.success) {
                setOrders(Array.isArray(data.orders) ? data.orders : [])
            } else if (!silent) {
                toast.error(data.message)
            }

        } catch (error) {
            if (!silent) {
                toast.error(error?.response?.data?.message || error.message)
            }
        } finally {
            if (initial) {
                setLoading(false)
            } else {
                setRefreshing(false)
            }
        }
    }, [getToken])

    useEffect(() => {
        if (user) {
            fetchSellerOrders({ initial: true });
        } else {
            setLoading(false);
        }
    }, [fetchSellerOrders, user]);

    useEffect(() => {
        if (!user) return;

        const refreshVisibleOrders = () => {
            if (document.visibilityState === 'visible') {
                fetchSellerOrders({ silent: true });
            }
        };

        const intervalId = setInterval(refreshVisibleOrders, 30000);

        window.addEventListener('focus', refreshVisibleOrders);
        document.addEventListener('visibilitychange', refreshVisibleOrders);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', refreshVisibleOrders);
            document.removeEventListener('visibilitychange', refreshVisibleOrders);
        };
    }, [fetchSellerOrders, user]);

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
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-medium">Orders</h2>
                        <p className="text-xs text-gray-500">
                            {refreshing ? 'Refreshing live status...' : 'Auto-updates every 30 seconds'}
                        </p>
                    </div>

                    {orders.length === 0 ? (
                        <div className="rounded-md border border-gray-300 p-8 text-center text-gray-500">
                            <p className="text-base font-medium">No orders yet</p>
                            <p>Add products and get first order information here.</p>
                        </div>
                    ) : (
                        <div className="max-w-5xl border-t border-gray-300 text-sm">
                            {orders.map((order) => {
                                const productLabel = getPrimaryOrderProductLabel(order);
                                const statusLabel = getOrderSummaryStatusLabel(order);
                                const paymentState = getOrderPaymentStateLabel(order);

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
                                                    src={order.items?.[0]?.product?.image?.[0] || assets.box_icon}
                                                    alt={order.items?.[0]?.product?.name || 'Product'}
                                                    width={64}
                                                    height={64}
                                                />
                                            </div>
                                            <div>
                                                <p className='text-sm font-semibold'>{productLabel}</p>
                                                <p className='text-xs text-gray-500'>Order Date: {new Date(order.date).toLocaleDateString()}</p>
                                                <p className='text-xs text-gray-500'>Total: {formatPrice(order.amountInr ? order.amountInr : convertUSDToINR(order.amount), currency)}</p>
                                            </div>
                                        </div>
                                        <div className='flex-1'>
                                            <div className='h-2 rounded-full bg-gray-200 overflow-hidden mb-1'>
                                                <div
                                                    className='h-full bg-green-500'
                                                    style={{
                                                        width: `${animationReady ? getSellerProgressPercent(order) : 0}%`,
                                                        transition: [ORDER_STATUSES.CANCELED, ORDER_STATUSES.REFUNDED, ORDER_STATUSES.RETURNED].includes(order.status) ? 'none' : 'width 900ms ease-in-out'
                                                    }}
                                                />
                                            </div>
                                            <p className={`text-sm font-semibold ${getOrderSummaryStatusClass(order)}`}>Status: {statusLabel}</p>
                                            <p className='text-xs text-gray-500'>{getSellerOrderDetails(order)}</p>
                                        </div>
                                        <div className='flex flex-col justify-center'>
                                            <span className={`text-xs ${getOrderPaymentStateClass(order)}`}>
                                                {paymentState}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            <Footer />
        </div>
    );
};

export default Orders;
