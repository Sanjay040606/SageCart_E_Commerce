'use client'

import { assets } from '@/assets/assets'
import Footer from '@/components/seller/Footer'
import { useAppContext } from '@/context/AppContext'
import { convertUSDToINR, formatPrice } from '@/lib/currencyUtils'
import {
  ORDER_STATUSES,
  getOrderMilestones,
  getReturnMilestones,
  getStatusTimestamp,
  getTimelineEntry,
  hasCanceledFlow,
  hasReturnFlow,
  isPrepaidOrder,
  syncOrderWithSystemTime
} from '@/lib/orderLifecycle'
import {
  getOrderPaymentStateClass,
  getOrderPaymentStateLabel,
  getOrderSummaryStatusClass,
  getOrderSummaryStatusLabel,
  getPrimaryOrderProductLabel
} from '@/lib/orderDisplay'
import { getProductPrimaryImage, normalizeProductImageUrl } from '@/lib/productDisplay'
import axios from 'axios'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const TRACKING_STEPS = [
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.SHIPPED,
  ORDER_STATUSES.OUT_FOR_DELIVERY,
  ORDER_STATUSES.DELIVERED
]

const formatStatusDate = (value) => {
  if (!value) return 'Not yet'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not yet'

  return parsed.toLocaleDateString('en-GB')
}

const getStatusIcon = (status) => {
  switch (status) {
    case ORDER_STATUSES.CONFIRMED:
      return 'C'
    case ORDER_STATUSES.SHIPPED:
      return 'S'
    case ORDER_STATUSES.OUT_FOR_DELIVERY:
      return 'D'
    case ORDER_STATUSES.DELIVERED:
      return 'L'
    case ORDER_STATUSES.CANCELED:
      return 'X'
    case ORDER_STATUSES.REFUND_INITIATED:
      return 'R'
    case ORDER_STATUSES.REFUNDED:
      return 'R'
    case ORDER_STATUSES.RETURN_CONFIRMED:
      return 'R'
    case ORDER_STATUSES.OUT_FOR_PICKUP:
      return 'P'
    case ORDER_STATUSES.RETURNED:
      return 'R'
    default:
      return '*'
  }
}

const getTimelineStatusDate = (order, status) => {
  const timelineEntry = getTimelineEntry(order, status)
  const { shippedEta, deliveryEta } = getOrderMilestones(order || {})
  const returnMilestones = getReturnMilestones(order || {})

  if (status === ORDER_STATUSES.REFUNDED && hasReturnFlow(order) && order?.status !== ORDER_STATUSES.REFUNDED) {
    return formatStatusDate(returnMilestones?.refundCompletedEta || order?.refundCompletedAt)
  }
  if (status === ORDER_STATUSES.REFUNDED && order?.refundCompletedAt) {
    return formatStatusDate(order.refundCompletedAt)
  }
  if (timelineEntry) return formatStatusDate(timelineEntry.timestamp)
  if (status === ORDER_STATUSES.CONFIRMED) return formatStatusDate(order?.date)
  if (status === ORDER_STATUSES.SHIPPED) return formatStatusDate(order?.shippedAt || shippedEta)
  if (status === ORDER_STATUSES.OUT_FOR_DELIVERY) return formatStatusDate(order?.deliveredAt || deliveryEta)
  if (status === ORDER_STATUSES.DELIVERED) return formatStatusDate(order?.deliveredAt || deliveryEta)
  if (status === ORDER_STATUSES.CANCELED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order?.canceledAt))
  if (status === ORDER_STATUSES.REFUND_INITIATED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order?.refundRequestedAt))
  if (status === ORDER_STATUSES.REFUNDED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order?.refundCompletedAt))
  if (status === ORDER_STATUSES.RETURN_CONFIRMED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.RETURN_CONFIRMED, order?.returnRequestedAt))
  if (status === ORDER_STATUSES.OUT_FOR_PICKUP) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.OUT_FOR_PICKUP, returnMilestones?.outForPickupEta))
  if (status === ORDER_STATUSES.RETURNED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.RETURNED, returnMilestones?.returnedEta))
  return 'Not yet'
}

const SellerOrderDetail = () => {
  const params = useParams()
  const id = params?.id
  const router = useRouter()
  const { getToken, currency } = useAppContext()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [progress, setProgress] = useState(0)

  const fetchOrder = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      const token = await getToken()
      const { data } = await axios.get(`/api/order/seller/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        const { order: syncedOrder } = syncOrderWithSystemTime(data.order, new Date())
        setOrder(syncedOrder)
        return syncedOrder
      }

      toast.error(data.message)
      router.push('/seller/orders')
      return null
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
      router.push('/seller/orders')
      return null
    } finally {
      if (showLoader) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [getToken, id, router])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    fetchOrder()
  }, [fetchOrder, id])

  useEffect(() => {
    if (!order) return

    const syncInterval = setInterval(() => {
      const { order: syncedOrder, changed } = syncOrderWithSystemTime({ ...order }, new Date())
      if (changed) {
        setOrder(syncedOrder)
      }
    }, 60000)

    return () => clearInterval(syncInterval)
  }, [order])

  const lifecycle = useMemo(() => {
    if (!order) return null

    const { shippedEta, deliveryEta, returnDeadline } = getOrderMilestones(order)
    const returnMilestones = getReturnMilestones(order)
    const canceledFlow = hasCanceledFlow(order)
    const returnFlow = hasReturnFlow(order)
    const canceledAt = getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order.canceledAt)
    const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order.refundRequestedAt)
    const canceledRefundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order.refundCompletedAt)
    const returnConfirmedAt = getStatusTimestamp(order, ORDER_STATUSES.RETURN_CONFIRMED, order.returnRequestedAt)
    const outForPickupAt = getStatusTimestamp(order, ORDER_STATUSES.OUT_FOR_PICKUP, returnMilestones?.outForPickupEta)
    const returnedAt = getStatusTimestamp(order, ORDER_STATUSES.RETURNED, returnMilestones?.returnedEta)
    const returnRefundedAt = order.status === ORDER_STATUSES.REFUNDED
      ? getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order.refundCompletedAt || returnMilestones?.refundCompletedEta)
      : returnMilestones?.refundCompletedEta

    let steps = [...TRACKING_STEPS]
    if (canceledFlow) {
      steps = [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELED]
      if (isPrepaidOrder(order)) {
        steps.push(ORDER_STATUSES.REFUND_INITIATED)
        steps.push(ORDER_STATUSES.REFUNDED)
      }
    } else if (returnFlow || (order.status === ORDER_STATUSES.REFUNDED && getTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED))) {
      steps = steps.concat([
        ORDER_STATUSES.RETURN_CONFIRMED,
        ORDER_STATUSES.OUT_FOR_PICKUP,
        ORDER_STATUSES.RETURNED,
        ORDER_STATUSES.REFUNDED
      ])
    }

    let currentStatus = order.status || ORDER_STATUSES.CONFIRMED
    if (returnFlow && currentStatus === ORDER_STATUSES.REFUND_INITIATED) {
      currentStatus = ORDER_STATUSES.RETURNED
    }

    let headlineStatus = currentStatus
    let infoMessage = 'The order is confirmed and waiting for shipment.'

    if (canceledFlow && currentStatus === ORDER_STATUSES.REFUNDED) {
      headlineStatus = 'Canceled and Refunded'
      infoMessage = `Order canceled on ${formatStatusDate(canceledAt)}. Refund completed on ${formatStatusDate(canceledRefundedAt)}.`
    } else if (canceledFlow) {
      headlineStatus = isPrepaidOrder(order) ? ORDER_STATUSES.REFUND_INITIATED : ORDER_STATUSES.CANCELED
      infoMessage = isPrepaidOrder(order)
        ? `Order canceled on ${formatStatusDate(canceledAt)}. Refund initiated on ${formatStatusDate(refundInitiatedAt)}.`
        : `Order canceled on ${formatStatusDate(canceledAt)}.`
    } else if (returnFlow) {
      if (currentStatus === ORDER_STATUSES.REFUNDED) {
        headlineStatus = 'Return Refunded'
        infoMessage = `Return completed and refund processed on ${formatStatusDate(returnRefundedAt)}.`
      } else if (currentStatus === ORDER_STATUSES.RETURNED) {
        headlineStatus = ORDER_STATUSES.RETURNED
        infoMessage = isPrepaidOrder(order)
          ? `Item returned on ${formatStatusDate(returnedAt)}. Refund will complete on ${formatStatusDate(returnMilestones?.refundCompletedEta)}.`
          : `Item returned on ${formatStatusDate(returnedAt)}.`
      } else if (currentStatus === ORDER_STATUSES.OUT_FOR_PICKUP) {
        headlineStatus = ORDER_STATUSES.OUT_FOR_PICKUP
        infoMessage = `Pickup scheduled for ${formatStatusDate(outForPickupAt)}.`
      } else {
        headlineStatus = ORDER_STATUSES.RETURN_CONFIRMED
        infoMessage = `Return confirmed on ${formatStatusDate(returnConfirmedAt)}. Pickup will happen on ${formatStatusDate(returnMilestones?.outForPickupEta)}.`
      }
    } else if (currentStatus === ORDER_STATUSES.DELIVERED) {
      infoMessage = `Delivered on ${formatStatusDate(order.deliveredAt)}. Return available until ${formatStatusDate(returnDeadline)}.`
    } else if (currentStatus === ORDER_STATUSES.OUT_FOR_DELIVERY) {
      infoMessage = `Out for delivery. ETA ${formatStatusDate(deliveryEta)}.`
    } else if (currentStatus === ORDER_STATUSES.SHIPPED) {
      infoMessage = `Shipped on ${formatStatusDate(order.shippedAt || shippedEta)}.`
    } else {
      infoMessage = `Shipment ETA ${formatStatusDate(shippedEta)}. Delivery ETA ${formatStatusDate(deliveryEta)}.`
    }

    const currentIndex = Math.max(0, steps.indexOf(currentStatus))
    const progressValue = steps.length > 0 && currentIndex >= 0
      ? ((currentIndex + 1) / steps.length) * 100
      : 0

    return {
      shippedEta,
      deliveryEta,
      returnDeadline,
      canceledFlow,
      returnFlow,
      steps,
      currentStatus,
      currentIndex,
      progressValue,
      headlineStatus,
      infoMessage
    }
  }, [order])

  useEffect(() => {
    if (!lifecycle) return
    const timer = setTimeout(() => setProgress(lifecycle.progressValue), 120)
    return () => clearTimeout(timer)
  }, [lifecycle])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (!order || !lifecycle) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-800">Order not found</p>
          <button
            type="button"
            onClick={() => router.push('/seller/orders')}
            className="mt-4 rounded-full bg-[var(--accent-strong)] px-5 py-2 text-sm text-white"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const buyer = order.userId && typeof order.userId === 'object' ? order.userId : null
  const address = order.address && typeof order.address === 'object' ? order.address : null
  const buyerName = buyer?.name || 'Unnamed buyer'
  const buyerEmail = buyer?.email || 'No email available'
  const productLabel = getPrimaryOrderProductLabel(order)
  const statusLabel = getOrderSummaryStatusLabel(order)
  const paymentState = getOrderPaymentStateLabel(order)
  const buyerInitial = (buyerName || 'U').charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen flex-col justify-between bg-gray-50">
      <div className="px-4 py-4 md:px-8 md:py-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => router.push('/seller/orders')}
                className="mb-3 text-sm font-medium text-[var(--accent-strong)] hover:text-[var(--ink-900)]"
              >
                Back to Orders
              </button>
              <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Seller Order Details</h1>
              <p className="mt-1 text-sm text-gray-500">Order ID: {order._id}</p>
            </div>
            <p className="text-xs text-gray-500">
              {refreshing ? 'Refreshing live status...' : 'Auto-updates every 30 seconds'}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-tint)] text-lg font-semibold text-[var(--ink-900)]">
                  {buyerInitial}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Buyer</p>
                  <p className="text-base font-semibold text-gray-900">{buyerName}</p>
                  <p className="text-sm text-gray-500">{buyerEmail}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-800">Placed:</span> {new Date(order.date).toLocaleDateString('en-GB')}</p>
                <p><span className="font-medium text-gray-800">Payment:</span> {paymentState}</p>
                <p><span className="font-medium text-gray-800">Method:</span> {order.paymentMethod || 'COD'}</p>
                <p><span className="font-medium text-gray-800">Primary item:</span> {productLabel}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-400">Shipping Address</p>
              <div className="mt-3 space-y-1 text-sm text-gray-700">
                <p className="text-base font-semibold text-gray-900">{address?.fullName || 'Address unavailable'}</p>
                <p>{address?.phoneNumber || 'Phone not available'}</p>
                <p>{address?.area || 'Area not available'}</p>
                <p>{address?.city || 'City not available'}, {address?.state || 'State not available'}</p>
                <p>Pincode: {address?.pincode || 'N/A'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-400">Order Status</p>
              <div className="mt-3 space-y-3">
                <p className={`text-lg font-semibold ${getOrderSummaryStatusClass(order)}`}>{statusLabel}</p>
                <p className="text-sm text-gray-600">{lifecycle.infoMessage}</p>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">Delivery ETA: {formatStatusDate(lifecycle.deliveryEta)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Delivery Timeline</h2>
                <p className="text-sm text-gray-500">{lifecycle.headlineStatus}</p>
              </div>
              <p className="text-xs text-gray-500">Live status from the order system</p>
            </div>

            <div className="mt-4 overflow-x-auto pb-2">
              <div className="flex min-w-max items-center gap-0 text-xs">
                {lifecycle.steps.map((step, idx) => {
                  const completed = idx <= lifecycle.currentIndex
                  const connectorCompleted = idx < lifecycle.currentIndex

                  return (
                    <div key={step} className="flex items-center">
                      <div className="w-28 shrink-0 text-center">
                        <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full ${completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          {getStatusIcon(step)}
                        </div>
                        <p className={`mt-1 text-[10px] font-semibold ${completed ? 'text-gray-800' : 'text-gray-600'}`}>{step}</p>
                        <p className="text-[9px] text-gray-500">{getTimelineStatusDate(order, step)}</p>
                      </div>
                      {idx < lifecycle.steps.length - 1 && (
                        <div className={`mx-2 h-0.5 w-10 rounded-full sm:w-14 ${connectorCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Items Ordered</h2>
                  <p className="text-sm text-gray-500">Products purchased in this order</p>
                </div>
                <span className={`text-xs font-medium ${getOrderSummaryStatusClass(order)}`}>
                  {lifecycle.currentStatus}
                </span>
              </div>

              <div className="space-y-4">
                {order.items?.map((item, index) => {
                  const productData = item.product && typeof item.product === 'object' ? item.product : item
                  const productImage = normalizeProductImageUrl(item.productImage || getProductPrimaryImage(productData))
                  const productName = productData?.name || item.productName || 'Product'
                  const variantLabel = item.variantLabel || item.color || ''
                  const quantity = Number(item.quantity || 0)
                  const lineTotalInr = Number(item.lineTotalInr || 0)
                  const unitPriceInr = Number(item.offerPriceInr ?? item.variantPriceInr)
                  const fallbackPrice = quantity > 0 ? Math.round(lineTotalInr / quantity) : 0
                  const itemPrice = Number.isFinite(unitPriceInr) && unitPriceInr > 0
                    ? unitPriceInr
                    : fallbackPrice > 0
                      ? fallbackPrice
                      : convertUSDToINR(productData?.offerPrice || item.offerPriceInr || 0)

                  return (
                    <div key={`${item.productId || productName}-${index}`} className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 sm:flex-row">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        <Image
                          src={productImage || assets.box_icon}
                          alt={productName}
                          width={80}
                          height={80}
                          className="h-20 w-20 object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{productName}{variantLabel ? ` (${variantLabel})` : ''}</p>
                        <p className="mt-1 text-sm text-gray-600">Quantity: {quantity}</p>
                        <p className="mt-2 text-xs text-gray-500">Product ID: {item.productId || 'N/A'}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-gray-900">{formatPrice(Math.round(itemPrice * quantity), currency)}</p>
                        <p className="mt-1 text-xs text-gray-500">{formatPrice(itemPrice, currency)} each</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Buyer Snapshot</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <p><span className="font-medium text-gray-800">Name:</span> {buyerName}</p>
                  <p><span className="font-medium text-gray-800">Email:</span> {buyerEmail}</p>
                  <p><span className="font-medium text-gray-800">Order date:</span> {new Date(order.date).toLocaleString('en-GB')}</p>
                  <p><span className="font-medium text-gray-800">Current status:</span> {statusLabel}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Payment Summary</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Original Price</span>
                    <span>{formatPrice(order.originalTotalInr || (order.subTotalInr + (order.discountInr || 0)), currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-green-600">
                    <span>Product Discount</span>
                    <span>-{formatPrice((order.originalTotalInr || (order.subTotalInr + (order.discountInr || 0))) - (order.subTotalInr || 0), currency)}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatPrice(order.subTotalInr || 0, currency)}</span>
                  </div>
                  {order.discountInr > 0 && (
                    <div className="flex items-center justify-between text-green-600">
                      <span>Coupon Discount</span>
                      <span>-{formatPrice(order.discountInr, currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{order.shippingInr === 0 ? 'Free' : formatPrice(order.shippingInr, currency)}</span>
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-[var(--accent-strong)]">{formatPrice(order.amountInr || convertUSDToINR(order.amount), currency)}</span>
                  </div>
                  <p className={`pt-2 text-xs ${getOrderPaymentStateClass(order)}`}>{getOrderPaymentStateLabel(order)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default SellerOrderDetail
