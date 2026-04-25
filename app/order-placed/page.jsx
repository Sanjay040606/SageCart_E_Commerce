'use client'
import { assets } from '@/assets/assets'
import { useAppContext } from '@/context/AppContext'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/currencyUtils'
import { downloadInvoicePDF } from '@/lib/invoiceGenerator'
import toast from 'react-hot-toast'

const OrderPlaced = () => {

  const { router, currency } = useAppContext()
  const [invoice, setInvoice] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('sagecart-last-order')
    if (stored) {
      setInvoice(JSON.parse(stored))
    }

    // Optional auto redirect after 8s if they do not interact
    const timer = setTimeout(() => {
      router.push('/my-orders')
    }, 8000)

    return () => clearTimeout(timer)
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


  if (!invoice) {
    return (
      <div className='h-screen flex flex-col justify-center items-center gap-5'>
        <div className="flex justify-center items-center relative">
          <Image className="absolute p-5" src={assets.checkmark} alt='' />
          <div className="animate-spin rounded-full h-24 w-24 border-4 border-t-green-300 border-gray-200"></div>
        </div>
        <div className="text-center text-2xl font-semibold">Order Placed Successfully</div>
        <p className='text-gray-600'>Redirecting to My Orders...</p>
      </div>
    )
  }

  return (
    <div className='px-6 md:px-20 lg:px-32 py-8 min-h-screen'>
      <div className='max-w-3xl mx-auto border rounded-lg shadow-sm p-8'>
        <h1 className='text-3xl font-semibold text-[var(--accent)] mb-4'>Order Confirmed</h1>
        <p className='text-gray-700 mb-2'>Thank you! Your order has been placed and is being processed.</p>
        <p className='text-gray-500 mb-4'>Order ID: {invoice.order?._id || 'N/A'}</p>

        <div className='mb-4 border-t pt-4'>
          <p className='font-semibold mb-2'>Shipping Address</p>
          <p>{invoice.address.fullName}</p>
          <p>{invoice.address.area}, {invoice.address.city}, {invoice.address.state}</p>
          <p>{invoice.address.phoneNumber}</p>
        </div>

        <div className='mb-4 border-t pt-4'>
          <p className='font-semibold mb-2'>Order Items</p>
          {invoice.items.map((item, idx) => (
            <p key={idx}>{item.productName || item.name || item.product} × {item.quantity}</p>
          ))}
        </div>

        <div className='mb-4 border-t pt-4 space-y-2'>
          <div className='bg-gray-50 p-3 rounded'>
            <h3 className='font-semibold mb-2 text-gray-700'>Price Summary</h3>
            <div className='space-y-1 text-sm'>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Original Price</span>
                <span>₹{(Number(invoice.order?.originalTotalInr || invoice.originalTotalInr || (invoice.subTotalInr + (invoice.discountInr || 0)))).toLocaleString('en-IN')}</span>
              </div>
              <div className='flex justify-between text-green-600'>
                <span>Product Discount</span>
                <span>-₹{(Number((invoice.order?.originalTotalInr || invoice.originalTotalInr || (invoice.subTotalInr + (invoice.discountInr || 0))) - (invoice.subTotalInr || 0))).toLocaleString('en-IN')}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-gray-600'>Subtotal (After Product Discount)</span>
                <span>₹{(Number(invoice.subTotalInr || 0)).toLocaleString('en-IN')}</span>
              </div>
              {invoice.discountInr > 0 && (
                <div className='flex justify-between text-green-600'>
                  <span>Coupon Discount ({invoice.promoCode})</span>
                  <span>-₹{(Number(invoice.discountInr || 0)).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className='flex justify-between'>
                <span className='text-gray-600'>Shipping</span>
                <span>{invoice.shippingInr === 0 ? 'Free' : `₹${(Number(invoice.shippingInr || 0)).toLocaleString('en-IN')}`}</span>
              </div>
              {(invoice.paymentMethod === 'UPI' || invoice.paymentMethod === 'CARD') && (
                <div className='flex justify-between text-green-600'>
                  <span>UPI/Card Discount</span>
                  <span>-₹{(Number(invoice.paymentDiscountInr || 60)).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className='border-t pt-1 mt-1 font-bold flex justify-between text-lg'>
                <span>Total Amount</span>
                <span>₹{(Number(invoice.totalInr || 0)).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
          <p className='text-sm text-gray-600'>Promo Code: {invoice.promoCode || 'None'}</p>
          <p>Payment Method: {invoice.paymentMethod || invoice.order?.paymentMethod || 'COD'}</p>
          {invoice.paymentDetails && (
            <p className='text-sm text-gray-500'>
              {invoice.paymentDetails.upiId ? `UPI: ${invoice.paymentDetails.upiId}` : `Card: ****${invoice.paymentDetails.cardNumber}`}
            </p>
          )}
        </div>

        <div className='flex gap-3'>
          <button onClick={downloadInvoice} className='brand-button px-5 py-2 rounded-md'>Download Invoice</button>
          <button onClick={() => router.push('/my-orders')} className='bg-gray-200 text-gray-800 px-5 py-2 rounded-md hover:bg-gray-300'>Go to My Orders</button>
        </div>

        <p className='mt-4 text-sm text-gray-500'>You will be redirected to My Orders in a few seconds.</p>
      </div>
    </div>
  )
}

export default OrderPlaced
