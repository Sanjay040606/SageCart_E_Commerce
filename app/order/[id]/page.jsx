'use client'
import { useAppContext } from '@/context/AppContext'
import { convertUSDToINR, formatPrice } from '@/lib/currencyUtils'
import { assets } from '@/assets/assets'
import { downloadInvoicePDF } from '@/lib/invoiceGenerator'
import {
  ORDER_STATUSES,
  REFUND_DELAY_HOURS,
  canLeaveReview,
  canCancelOrder,
  canRequestReturn,
  getOrderMilestones,
  getStatusTimestamp,
  getTimelineEntry,
  hasCanceledFlow,
  hasReturnFlow,
  isPrepaidOrder,
  syncOrderWithSystemTime
} from '@/lib/orderLifecycle'
import axios from 'axios'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Chatbot from '@/components/Chatbot'
import { useParams } from 'next/navigation'

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
      return '✓'
    case ORDER_STATUSES.SHIPPED:
      return '📦'
    case ORDER_STATUSES.OUT_FOR_DELIVERY:
      return '🚚'
    case ORDER_STATUSES.DELIVERED:
      return '🏠'
    case ORDER_STATUSES.CANCELED:
      return '✕'
    case ORDER_STATUSES.REFUND_INITIATED:
      return '💳'
    case ORDER_STATUSES.REFUNDED:
      return '💸'
    case ORDER_STATUSES.RETURN_CONFIRMED:
      return '↩'
    case ORDER_STATUSES.OUT_FOR_PICKUP:
      return '🚛'
    case ORDER_STATUSES.RETURNED:
      return '📥'
    default:
      return '○'
  }
}

const getTimelineStatusDate = (order, status) => {
  const timelineEntry = getTimelineEntry(order, status)
  const { shippedEta, deliveryEta } = getOrderMilestones(order || {})

  if (timelineEntry) return formatStatusDate(timelineEntry.timestamp)
  if (status === ORDER_STATUSES.CONFIRMED) return formatStatusDate(order?.date)
  if (status === ORDER_STATUSES.SHIPPED) return formatStatusDate(order?.shippedAt || shippedEta)
  if (status === ORDER_STATUSES.OUT_FOR_DELIVERY) return formatStatusDate(order?.deliveredAt || deliveryEta)
  if (status === ORDER_STATUSES.DELIVERED) return formatStatusDate(order?.deliveredAt || deliveryEta)
  if (status === ORDER_STATUSES.CANCELED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order?.canceledAt))
  if (status === ORDER_STATUSES.REFUND_INITIATED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order?.refundRequestedAt))
  if (status === ORDER_STATUSES.REFUNDED) return formatStatusDate(getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order?.refundCompletedAt))
  return 'Not yet'
}

const OrderDetail = () => {
  const params = useParams()
  const id = params?.id
  const { router, getToken, currency, user } = useAppContext()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [reviewDrafts, setReviewDrafts] = useState({})
  const [reviewSubmittingId, setReviewSubmittingId] = useState(null)

  const fetchOrder = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true)
      const token = await getToken()
      const { data } = await axios.get(`/api/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        // Sync order with current system time to update status automatically
        const { order: syncedOrder, changed } = syncOrderWithSystemTime(data.order, new Date())

        if (changed) {
          // If order status changed, update it on the server
          try {
            await axios.patch(`/api/order/${id}`, {
              action: 'sync-status',
              order: syncedOrder
            }, {
              headers: { Authorization: `Bearer ${token}` }
            })
          } catch (syncError) {
            console.warn('Failed to sync order status:', syncError)
            // Continue with local sync even if server sync fails
          }
        }

        setOrder(syncedOrder)
        return syncedOrder
      }

      toast.error(data.message)
      router.push('/my-orders')
      return null
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
      router.push('/my-orders')
      return null
    } finally {
      if (showLoader) setLoading(false)
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
    setReviewDrafts({})
    setReviewSubmittingId(null)
  }, [id])

  // Periodic sync to keep order status updated with current time
  useEffect(() => {
    if (!order) return

    const syncInterval = setInterval(() => {
      const { order: syncedOrder, changed } = syncOrderWithSystemTime({ ...order }, new Date())
      if (changed) {
        setOrder(syncedOrder)
      }
    }, 60000) // Sync every minute

    return () => clearInterval(syncInterval)
  }, [order])

  const lifecycle = useMemo(() => {
    if (!order) return null

    const { shippedEta, deliveryEta, returnDeadline } = getOrderMilestones(order)
    const canceledFlow = hasCanceledFlow(order)
    const returnFlow = hasReturnFlow(order)
    const cancelAvailable = canCancelOrder(order)
    const returnAvailable = canRequestReturn(order)
    const canceledAt = getStatusTimestamp(order, ORDER_STATUSES.CANCELED, order.canceledAt)
    const refundInitiatedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUND_INITIATED, order.refundRequestedAt)
    const refundedAt = getStatusTimestamp(order, ORDER_STATUSES.REFUNDED, order.refundCompletedAt)

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
    let headlineStatus = currentStatus
    let infoMessage = 'Your order is confirmed and is waiting for shipment.'

    if (canceledFlow && currentStatus === ORDER_STATUSES.REFUNDED) {
      headlineStatus = 'Canceled and Refunded'
      infoMessage = `Order canceled on ${formatStatusDate(canceledAt)}. Refund completed on ${formatStatusDate(refundedAt)}.`
    } else if (canceledFlow) {
      headlineStatus = isPrepaidOrder(order) ? ORDER_STATUSES.REFUND_INITIATED : ORDER_STATUSES.CANCELED
      infoMessage = isPrepaidOrder(order)
        ? `Order canceled on ${formatStatusDate(canceledAt)}. Refund initiated on ${formatStatusDate(refundInitiatedAt)} and will complete in about ${REFUND_DELAY_HOURS} hours.`
        : `Order canceled on ${formatStatusDate(canceledAt)}. COD order has no refund stage.`
    } else if (returnFlow && currentStatus === ORDER_STATUSES.REFUNDED) {
      headlineStatus = 'Return Refunded'
      infoMessage = `Return completed and refund processed on ${formatStatusDate(order.refundCompletedAt)}.`
    } else if (currentStatus === ORDER_STATUSES.DELIVERED) {
      infoMessage = `Delivered on ${formatStatusDate(order.deliveredAt)}. Return available until ${formatStatusDate(returnDeadline)}.`
    } else if (currentStatus === ORDER_STATUSES.SHIPPED) {
      infoMessage = `Shipped on ${formatStatusDate(order.shippedAt || shippedEta)}.`
    } else {
      infoMessage = `Shipment ETA ${formatStatusDate(shippedEta)}. Delivery ETA ${formatStatusDate(deliveryEta)}.`
    }

    if (getTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED) && currentStatus !== ORDER_STATUSES.REFUNDED) {
      headlineStatus = ORDER_STATUSES.RETURN_CONFIRMED
      infoMessage = `Return confirmed on ${formatStatusDate(getTimelineEntry(order, ORDER_STATUSES.RETURN_CONFIRMED)?.timestamp)}. Pickup will happen today.`
    }

    const currentIndex = Math.max(0, steps.indexOf(currentStatus))
    const progressValue = steps.length > 0 && currentIndex >= 0
      ? ((currentIndex + 1) / steps.length) * 100
      : 0

    return {
      shippedEta,
      deliveryEta,
      returnDeadline,
      cancelAvailable,
      returnAvailable,
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

  const reviewAllowed = Boolean(order && canLeaveReview(order))

  const getReviewDraft = (productId, existingReview) => {
    return reviewDrafts[productId] || {
      rating: existingReview?.rating ?? 5,
      comment: existingReview?.comment ?? ''
    }
  }

  const handleReviewSubmit = async (event, productId, existingReview) => {
    event.preventDefault()

    if (!order?._id || reviewSubmittingId) return

    const draft = getReviewDraft(productId, existingReview)
    const trimmedComment = draft.comment?.trim()

    if (!trimmedComment) {
      toast.error('Please write a review comment.')
      return
    }

    try {
      setReviewSubmittingId(productId)
      const token = await getToken()
      const { data } = await axios.post(
        '/api/product/review',
        {
          productId,
          rating: draft.rating,
          comment: trimmedComment
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (data.success) {
        setOrder((currentOrder) => {
          if (!currentOrder) return currentOrder

          return {
            ...currentOrder,
            items: currentOrder.items.map((item) => {
              const currentProductId = item.product?._id?.toString?.() || item.product?.toString?.() || item.product
              if (currentProductId !== productId || !item.product || typeof item.product !== 'object') {
                return item
              }

              return {
                ...item,
                product: {
                  ...item.product,
                  reviews: data.reviews
                }
              }
            })
          }
        })

        setReviewDrafts((currentDrafts) => ({
          ...currentDrafts,
          [productId]: {
            rating: Number(draft.rating),
            comment: trimmedComment
          }
        }))

        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setReviewSubmittingId(null)
    }
  }

  useEffect(() => {
    if (!lifecycle) return
    const timer = setTimeout(() => setProgress(lifecycle.progressValue), 100)
    return () => clearTimeout(timer)
  }, [lifecycle])

  const performOrderAction = async (action) => {
    if (!order?._id || actionLoading) return

    try {
      setActionLoading(true)
      const token = await getToken()
      const { data } = await axios.patch(
        `/api/order/${order._id}`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (data.success) {
        await fetchOrder(false)
        if (action === 'cancel') {
          toast.success('Order canceled successfully.')
        } else if (action === 'request-return') {
          toast.success('Return process completed successfully.')
        } else {
          toast.success('Order updated successfully.')
        }
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const downloadInvoice = () => {
    downloadInvoicePDF({
      order,
      items: order?.items,
      address: order?.address,
      subTotalInr: order?.originalTotalInr || (order?.subTotalInr + (order?.discountInr || 0)),
      offerSubTotalInr: order?.subTotalInr,
      discountInr: order?.discountInr || 0,
      shippingInr: order?.shippingInr || 0,
      paymentDiscountInr: order?.paymentDiscountInr || ((order?.paymentMethod === 'UPI' || order?.paymentMethod === 'CARD') ? 60 : 0),
      amountInr: order?.amountInr,
      paymentMethod: order?.paymentMethod,
      status: order?.status
    })
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className='h-screen flex items-center justify-center'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent)] border-t-transparent mx-auto mb-4'></div>
            <p className='text-gray-600'>Loading order details...</p>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  if (!order || !lifecycle) {
    return (
      <>
        <Navbar />
        <div className='h-screen flex items-center justify-center'>
          <p className='text-gray-600'>Order not found</p>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className='px-4 md:px-20 lg:px-32 py-4 md:py-8 min-h-screen bg-gray-50'>
        <div className='mx-auto w-full max-w-4xl'>
          <div className='mb-8'>
            <button
              onClick={() => router.push('/my-orders')}
              className='text-[var(--accent-strong)] hover:text-[var(--ink-900)] text-sm mb-4 flex items-center gap-1'
            >
              ← Back to Orders
            </button>

            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <h1 className='text-3xl font-semibold text-gray-800'>Order Details</h1>
                <p className='text-gray-600'>Order ID: {order._id}</p>
              </div>
              <button
                onClick={downloadInvoice}
                className='brand-button px-4 py-2 rounded-md'
              >
                Download Invoice
              </button>
            </div>
          </div>

          <div className='mb-6 rounded-2xl bg-white p-4 shadow-sm md:p-6'>
            <h2 className='text-xl font-semibold mb-4'>Order Status</h2>

            <div className='flex flex-col gap-3'>
              <div className='h-2 rounded-full bg-gray-200 overflow-hidden'>
                <div
                  className='h-full bg-[var(--accent)] transition-all duration-1000 ease-out'
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className='text-sm font-medium text-gray-700'>
                <p>{lifecycle.headlineStatus}</p>
                <p className='text-gray-500 mt-1'>{lifecycle.infoMessage}</p>
              </div>

              <div className='mt-4 overflow-x-auto pb-2'>
                <div className='flex min-w-max items-center gap-0 text-xs'>
                  {lifecycle.steps.map((step, idx) => {
                    const completed = idx <= lifecycle.currentIndex
                    const connectorCompleted = idx < lifecycle.currentIndex
                    return (
                      <div key={step} className='flex items-center'>
                        <div className='w-28 shrink-0 text-center'>
                          <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full ${completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {getStatusIcon(step)}
                          </div>
                          <p className={`mt-1 text-[10px] font-semibold ${completed ? 'text-gray-800' : 'text-gray-600'}`}>{step}</p>
                          <p className='text-[9px] text-gray-500'>{getTimelineStatusDate(order, step)}</p>
                        </div>
                        {idx < lifecycle.steps.length - 1 && (
                          <div className={`mx-2 h-0.5 w-10 sm:w-14 rounded-full ${connectorCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className='mt-4 flex flex-wrap gap-3'>
                {lifecycle.cancelAvailable && (
                  <button
                    onClick={() => performOrderAction('cancel')}
                    disabled={actionLoading}
                    className='bg-red-500 text-white px-3 py-2 rounded-md text-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed'
                  >
                    {actionLoading ? 'Updating...' : 'Cancel Order'}
                  </button>
                )}

                {!lifecycle.cancelAvailable && !lifecycle.canceledFlow && !order.deliveredAt && (
                  <p className='text-sm text-gray-500'>Cannot cancel after shipment. Shipment date: {formatStatusDate(order.shippedAt || lifecycle.shippedEta)}</p>
                )}

                {lifecycle.returnAvailable && (
                  <button
                    onClick={() => performOrderAction('request-return')}
                    disabled={actionLoading}
                    className='bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed'
                  >
                    {actionLoading ? 'Updating...' : 'Return Order'}
                  </button>
                )}

                {order.deliveredAt && !lifecycle.returnAvailable && !lifecycle.returnFlow && (
                  <p className='text-sm text-gray-500'>Return window closed on {formatStatusDate(lifecycle.returnDeadline)}</p>
                )}
              </div>
            </div>
          </div>

          <div className='mb-6 rounded-2xl bg-white p-4 shadow-sm md:p-6'>
            <h2 className='text-xl font-semibold mb-3'>Items Ordered</h2>
            <p className='text-sm text-gray-500 mb-5'>
              {reviewAllowed
                ? 'This order is delivered or returned, so you can review each product here.'
                : 'Reviews unlock after delivery and can only be submitted from this order page.'}
            </p>
            <div className='space-y-4'>
              {order.items && order.items.map((item, idx) => {
                const productData = item.product || {}
                const productImage = productData?.image?.[0]
                const productName = productData?.name || item.productName || 'Product'
                const productPrice = convertUSDToINR(productData?.offerPrice || item.offerPrice || 0)
                const productId = productData?._id?.toString?.() || productData?._id
                const productReviews = Array.isArray(productData?.reviews) ? productData.reviews : []
                const myReview = productReviews.find((review) => review.userId === user?.id)
                const reviewDraft = getReviewDraft(productId, myReview)
                const canEditReview = reviewAllowed || Boolean(myReview)

                return (
                  <div key={idx} className='pb-4 border-b last:border-b-0'>
                    <div className='flex flex-col gap-4 cursor-pointer rounded-xl p-2 -m-2 hover:bg-gray-50 sm:flex-row' onClick={() => productId && router.push(`/product/${productId}`)}>
                      <div className='w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0'>
                        {productImage ? (
                          <Image
                            src={productImage}
                            alt={productName}
                            width={80}
                            height={80}
                            className='w-20 h-20 object-cover rounded-lg'
                          />
                        ) : (
                          <div className='w-20 h-20 flex items-center justify-center text-gray-400'>No image</div>
                        )}
                      </div>
                      <div className='flex-1'>
                        <p className='font-semibold text-gray-800'>{productName} {item.color ? `(${item.color})` : ''}</p>
                        <p className='text-sm text-gray-600'>Quantity: {item.quantity}</p>
                        <p className='text-sm font-medium mt-2'>
                          {formatPrice(productPrice, currency)} each
                        </p>
                      </div>
                      <div className='text-left sm:text-right'>
                        <p className='font-semibold'>
                          {formatPrice(Math.round(productPrice * item.quantity), currency)}
                        </p>
                      </div>
                    </div>

                    {canEditReview ? (
                      <div className='mt-4 rounded-2xl border border-[var(--line-soft)] bg-gray-50 p-4' onClick={(event) => event.stopPropagation()}>
                        <div className='flex flex-wrap items-center justify-between gap-2 mb-3'>
                          <div>
                            <p className='font-semibold text-gray-800'>
                              {myReview ? 'Your review' : 'Leave a review'}
                            </p>
                            <p className='text-xs text-gray-500'>
                              {reviewAllowed
                                ? 'Only delivered orders can be reviewed here.'
                                : 'You can view your existing review here.'}
                            </p>
                          </div>
                          <span className='text-xs font-medium rounded-full bg-green-100 px-2.5 py-1 text-green-700'>
                            Verified buyer
                          </span>
                        </div>

                        {myReview && !reviewAllowed ? (
                          <div className='space-y-2'>
                            <div className='flex items-center gap-0.5'>
                              {Array.from({ length: 5 }).map((_, reviewIndex) => (
                                <Image
                                  key={reviewIndex}
                                  className='h-3 w-3'
                                  src={reviewIndex < myReview.rating ? assets.star_icon : assets.star_dull_icon}
                                  alt='star'
                                />
                              ))}
                            </div>
                            <p className='text-sm text-gray-700'>{myReview.comment}</p>
                            <p className='text-xs text-gray-500'>
                              Reviewed on {new Date(myReview.date).toLocaleDateString()}
                            </p>
                          </div>
                        ) : (
                          <form onSubmit={(event) => handleReviewSubmit(event, productId, myReview)} className='space-y-3'>
                            <div>
                              <label className='block text-sm font-medium text-gray-700 mb-1'>Rating</label>
                              <select
                                value={reviewDraft.rating}
                                onChange={(event) => {
                                  const ratingValue = Number(event.target.value)
                                  setReviewDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [productId]: {
                                      ...reviewDraft,
                                      rating: ratingValue
                                    }
                                  }))
                                }}
                                className='w-full md:w-56 border border-gray-300 rounded-md p-2 outline-none focus:border-[var(--accent)]'
                              >
                                <option value={5}>5 Stars - Excellent</option>
                                <option value={4}>4 Stars - Good</option>
                                <option value={3}>3 Stars - Average</option>
                                <option value={2}>2 Stars - Poor</option>
                                <option value={1}>1 Star - Terrible</option>
                              </select>
                            </div>

                            <div>
                              <label className='block text-sm font-medium text-gray-700 mb-1'>Comment</label>
                              <textarea
                                required
                                rows='4'
                                value={reviewDraft.comment}
                                onChange={(event) => {
                                  const commentValue = event.target.value
                                  setReviewDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [productId]: {
                                      ...reviewDraft,
                                      comment: commentValue
                                    }
                                  }))
                                }}
                                placeholder='Share your experience with this product...'
                                className='w-full border border-gray-300 rounded-md p-3 outline-none focus:border-[var(--accent)] resize-none'
                              />
                            </div>

                            <button
                              type='submit'
                              disabled={reviewSubmittingId === productId}
                              className={`px-5 py-2 bg-[var(--accent-strong)] text-white rounded-full transition hover:bg-[var(--accent-strong)]/90 ${reviewSubmittingId === productId ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {reviewSubmittingId === productId
                                ? 'Submitting...'
                                : myReview
                                  ? 'Update Review'
                                  : 'Submit Review'}
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <p className='mt-4 text-xs text-gray-500'>Reviews unlock after delivery.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className='mb-6 grid gap-4 md:grid-cols-2 md:gap-6'>
            <div className='rounded-2xl bg-white p-4 shadow-sm md:p-6'>
              <h3 className='font-semibold text-gray-800 mb-3'>Shipping Address</h3>
              <p className='text-gray-700'>{order.address.fullName}</p>
              <p className='text-gray-600 text-sm'>{order.address.area}</p>
              <p className='text-gray-600 text-sm'>{order.address.city}, {order.address.state}</p>
              <p className='text-gray-600 text-sm'>{order.address.phoneNumber}</p>
            </div>

            <div className='rounded-2xl bg-white p-4 shadow-sm md:p-6'>
              <h3 className='font-semibold text-gray-800 mb-3'>Payment & Timeline</h3>
              <p className='text-gray-700 mb-2'>
                <span className='font-medium'>Method:</span> {order.paymentMethod || 'COD'}
              </p>
              <p className='text-gray-700 mb-2'>
                <span className='font-medium'>Placed:</span> {formatStatusDate(order.date)}
              </p>
              <p className='text-gray-700 mb-2'>
                <span className='font-medium'>Shipment ETA:</span> {formatStatusDate(lifecycle.shippedEta)}
              </p>
              <p className='text-gray-700 mb-2'>
                <span className='font-medium'>Delivery ETA:</span> {formatStatusDate(lifecycle.deliveryEta)}
              </p>
              {order.deliveredAt && (
                <p className='text-gray-700'>
                  <span className='font-medium'>Return available until:</span> {formatStatusDate(lifecycle.returnDeadline)}
                </p>
              )}
            </div>
          </div>

          <div className='rounded-2xl bg-white p-4 shadow-sm md:p-6'>
            <h2 className='text-xl font-semibold mb-6'>Price Summary</h2>
            <div className='space-y-3'>
              <div className='flex justify-between text-gray-600'>
                <span>Original Price</span>
                <span>{formatPrice(order.originalTotalInr || (order.subTotalInr + (order.discountInr || 0)), currency)}</span>
              </div>
              <div className='flex justify-between text-green-600'>
                <span>Product Discount</span>
                <span>-{formatPrice((order.originalTotalInr || (order.subTotalInr + (order.discountInr || 0))) - (order.subTotalInr || 0), currency)}</span>
              </div>
              <div className='flex justify-between text-gray-600'>
                <span>Subtotal (After Product Discount)</span>
                <span>{formatPrice(order.subTotalInr || 0, currency)}</span>
              </div>
              {order.discountInr > 0 && (
                <div className='flex justify-between text-green-600'>
                  <span>Coupon Discount ({order.promoCode})</span>
                  <span>-{formatPrice(order.discountInr, currency)}</span>
                </div>
              )}
              <div className='flex justify-between text-gray-600'>
                <span>Shipping</span>
                <span>{order.shippingInr === 0 ? 'Free' : formatPrice(order.shippingInr, currency)}</span>
              </div>
              {(order.paymentMethod === 'UPI' || order.paymentMethod === 'CARD') && (
                <div className='flex justify-between text-green-600'>
                  <span>UPI/Card Discount</span>
                  <span>-{formatPrice(order.paymentDiscountInr || 60, currency)}</span>
                </div>
              )}
              <div className='border-t pt-3 flex justify-between text-xl font-bold'>
                <span>Total Amount</span>
                <span className='text-[var(--accent-strong)]'>{formatPrice(order.amountInr, currency)}</span>
              </div>
            </div>
          </div>

          <div className='mt-6 rounded-2xl bg-white p-4 shadow-sm md:p-6'>
            <h3 className='text-lg font-semibold mb-3'>Need Help?</h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
              {[
                'How can I track my order?',
                'How to cancel order?',
                'How to return after delivery?',
                'How to get refund status?'
              ].map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(`/help?q=${encodeURIComponent(q)}`)}
                  className='text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg p-2 text-left border border-gray-200'
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Chatbot pageContext="order-detail" orderId={order?._id} />
      <Footer />
    </>
  )
}

export default OrderDetail




