'use client'
import { useAppContext } from '@/context/AppContext'
import { useEffect, useState } from 'react'
import { downloadInvoicePDF } from '@/lib/invoiceGenerator'
import OrderPlacedGlow from '@/components/OrderPlacedGlow'

const ORDER_ANIMATION_MS = 3600
const ORDER_REDIRECT_MS = 8000

const OrderPlaced = () => {
  const { router } = useAppContext()
  const [invoice, setInvoice] = useState(null)
  const [animationDone, setAnimationDone] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sagecart-last-order')
    if (stored) {
      try {
        setInvoice(JSON.parse(stored))
      } catch {
        setInvoice(null)
      }
    }

    const animationTimer = setTimeout(() => {
      setAnimationDone(true)
    }, ORDER_ANIMATION_MS)

    const redirectTimer = setTimeout(() => {
      router.push('/my-orders')
    }, ORDER_REDIRECT_MS)

    return () => {
      clearTimeout(animationTimer)
      clearTimeout(redirectTimer)
    }
  }, [router])

  const downloadInvoice = () => {
    downloadInvoicePDF({
      order: invoice?.order,
      items: invoice?.items,
      address: invoice?.address,
      subTotalInr: invoice?.subTotalInr || 0,
      offerSubTotalInr: invoice?.offerSubTotalInr || invoice?.subTotalInr || 0,
      discountInr: invoice?.discountInr || 0,
      shippingInr: invoice?.shippingInr || 0,
      paymentDiscountInr: invoice?.paymentDiscountInr || 0,
      amountInr: invoice?.totalInr || 0,
      paymentMethod: invoice?.paymentMethod,
      status: invoice?.order?.status || 'Confirmed'
    })
  }

  const showSummary = animationDone && Boolean(invoice)
  const showOverlay = !animationDone || !invoice

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f6f2ea_100%)]">
      {showOverlay && (
        <OrderPlacedGlow
          fullscreen
          showCopy={false}
          className="pointer-events-none"
        />
      )}

      {showSummary && (
        <div className="px-6 py-8 md:px-20 lg:px-32">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--line-soft)] bg-white/90 p-8 shadow-sm backdrop-blur">
            <p className="mb-2 text-gray-700">Thank you! Your order has been placed and is being processed.</p>
            <p className="mb-4 text-gray-500">Order ID: {invoice.order?._id || 'N/A'}</p>

            <div className="mb-4 border-t pt-4">
              <p className="mb-2 font-semibold">Shipping Address</p>
              <p>{invoice.address.fullName}</p>
              <p>{invoice.address.area}, {invoice.address.city}, {invoice.address.state}</p>
              <p>{invoice.address.phoneNumber}</p>
            </div>

            <div className="mb-4 border-t pt-4">
              <p className="mb-2 font-semibold">Order Items</p>
              {invoice.items.map((item, idx) => (
                <p key={idx}>
                  {item.productName || item.name || item.product}
                  {item.variantLabel || item.color ? ` (${item.variantLabel || item.color})` : ''}
                  {' '}x {item.quantity}
                </p>
              ))}
            </div>

            <div className="mb-4 border-t pt-4 space-y-2">
              <div className="rounded bg-gray-50 p-3">
                <h3 className="mb-2 font-semibold text-gray-700">Price Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original Price</span>
                    <span>Rs. {(Number(invoice.order?.originalTotalInr || invoice.originalTotalInr || (invoice.subTotalInr + (invoice.discountInr || 0)))).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Product Discount</span>
                    <span>-Rs. {(Number((invoice.order?.originalTotalInr || invoice.originalTotalInr || (invoice.subTotalInr + (invoice.discountInr || 0))) - (invoice.subTotalInr || 0))).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal (After Product Discount)</span>
                    <span>Rs. {(Number(invoice.subTotalInr || 0)).toLocaleString('en-IN')}</span>
                  </div>
                  {invoice.discountInr > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Coupon Discount ({invoice.promoCode})</span>
                      <span>-Rs. {(Number(invoice.discountInr || 0)).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span>{invoice.shippingInr === 0 ? 'Free' : `Rs. ${(Number(invoice.shippingInr || 0)).toLocaleString('en-IN')}`}</span>
                  </div>
                  {(invoice.paymentMethod === 'UPI' || invoice.paymentMethod === 'CARD') && (
                    <div className="flex justify-between text-green-600">
                      <span>UPI/Card Discount</span>
                      <span>-Rs. {(Number(invoice.paymentDiscountInr || 60)).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="mt-1 flex justify-between border-t pt-1 text-lg font-bold">
                    <span>Total Amount</span>
                    <span>Rs. {(Number(invoice.totalInr || 0)).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">Promo Code: {invoice.promoCode || 'None'}</p>
              <p>Payment Method: {invoice.paymentMethod || invoice.order?.paymentMethod || 'COD'}</p>
              {invoice.paymentDetails && (
                <p className="text-sm text-gray-500">
                  {invoice.paymentDetails.upiId ? `UPI: ${invoice.paymentDetails.upiId}` : `Card: ****${invoice.paymentDetails.cardNumber}`}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={downloadInvoice} className="brand-button rounded-md px-5 py-2">Download Invoice</button>
              <button onClick={() => router.push('/my-orders')} className="rounded-md bg-gray-200 px-5 py-2 text-gray-800 hover:bg-gray-300">Go to My Orders</button>
            </div>

            <p className="mt-4 text-sm text-gray-500">You will be redirected to My Orders in a few seconds.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderPlaced
