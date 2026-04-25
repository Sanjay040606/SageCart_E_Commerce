'use client'
import { assets } from '@/assets/assets'
import { useAppContext } from '@/context/AppContext'
import axios from 'axios'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/currencyUtils'

const PaymentPage = () => {

  const { router, getToken, setCartItems } = useAppContext()
  const [paymentData, setPaymentData] = useState(null)
  const [step, setStep] = useState('details') // 'details', 'pin', 'success'
  const [loading, setLoading] = useState(false)

  const [upiId, setUpiId] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [pinCode, setPinCode] = useState('')

  // Validation: UPI ID should contain @ symbol
  const isValidUPI = (upi) => {
    return upi.includes('@') && upi.trim().length > 0
  }

  // Validation: Card number should be exactly 16 digits
  const isValidCardNumber = (cardNum) => {
    const digits = cardNum.replace(/\s/g, '')
    return digits.length === 16 && /^\d+$/.test(digits)
  }

  // Validation: Expiry date should be MM/YY format
  const isValidExpiryDate = (expiry) => {
    const pattern = /^\d{2}\/\d{2}$/
    if (!pattern.test(expiry)) return false
    
    const [month, year] = expiry.split('/')
    const monthNum = parseInt(month, 10)
    return monthNum >= 1 && monthNum <= 12
  }

  // Handle expiry date input - auto format with /
  const handleExpiryDateChange = (e) => {
    let value = e.target.value.replace(/\D/g, '') // Remove non-digits
    
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4)
    }
    
    setExpiryDate(value)
  }

  // Handle card number input - only digits, max 16
  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '') // Remove non-digits
    if (value.length <= 16) {
      // Format as 16 digit number
      const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ')
      setCardNumber(formatted.trim())
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('sagecart-payment-data')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        setPaymentData(data)
      } catch (e) {
        console.error("Failed to parse payment data", e)
        router.push('/cart')
      }
    } else {
      router.push('/cart')
    }
  }, [router])

  const handleDetailsSubmit = (e) => {
    e.preventDefault()

    if (paymentData.paymentMethod === 'UPI') {
      if (!upiId.trim()) {
        return toast.error('Please enter UPI ID')
      }
      if (!isValidUPI(upiId)) {
        return toast.error('Invalid UPI ID')
      }
    } else if (paymentData.paymentMethod === 'CARD') {
      if (!cardName.trim()) {
        return toast.error('Please enter cardholder name')
      }
      if (!cardNumber.trim()) {
        return toast.error('Please enter card number')
      }
      if (!isValidCardNumber(cardNumber)) {
        return toast.error('Invalid card number')
      }
      if (!expiryDate.trim()) {
        return toast.error('Please enter expiry date')
      }
      if (!isValidExpiryDate(expiryDate)) {
        return toast.error('Invalid expiry date')
      }
    }

    setStep('pin')
  }

  const handlePinSubmit = async (e) => {
    e.preventDefault()

    if (!pinCode || pinCode.length < 4) {
      return toast.error('Please enter valid PIN (4-6 digits)')
    }

    setLoading(true)

    try {
      const token = await getToken()

      const addressId = paymentData.address?._id || paymentData.address
      if (!addressId) {
        toast.error('Address not found. Please go back and select an address.')
        setLoading(false)
        return
      }

      const { data } = await axios.post('/api/order/create', {
        address: addressId,
        items: paymentData.items,
        promoCode: paymentData.promoCode,
        paymentMethod: paymentData.paymentMethod,
        paymentDiscountInr: paymentData.paymentDiscountInr || 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        toast.success('Payment Successful!')

        const payloadForInvoice = {
          order: data.order,
          address: paymentData.address,
          items: paymentData.invoiceItems || paymentData.items,
          originalTotalInr: data.order.originalTotalInr,
          subTotalInr: data.order.subTotalInr,
          shippingInr: data.order.shippingInr,
          discountInr: data.order.discountInr,
          paymentDiscountInr: data.order.paymentDiscountInr || 0,
          totalInr: data.order.amountInr,
          promoCode: data.order.promoCode,
          paymentMethod: data.order.paymentMethod,
          paymentDetails: paymentData.paymentMethod === 'UPI' ? { upiId } : { cardNumber: cardNumber.slice(-4) },
          placedAt: new Date().toLocaleString()
        }

        localStorage.setItem('sagecart-last-order', JSON.stringify(payloadForInvoice))
        localStorage.removeItem('sagecart-payment-data')

        setCartItems({})
        setStep('success')

        setTimeout(() => {
          router.push('/order-placed')
        }, 3000)
      } else {
        toast.error(data.message)
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message
      const unavailableProducts = error.response?.data?.unavailableProducts

      if (unavailableProducts?.length) {
        unavailableProducts.forEach((item) => {
          const productLabel = item.productName || item.productId || 'Item'
          toast.error(`${productLabel}: ${item.reason}${item.available != null ? ` (available: ${item.available})` : ''}`)
        })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!paymentData) {
    return (
      <div className='h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent)] border-t-transparent mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading payment details...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='px-6 md:px-20 lg:px-32 py-8 min-h-screen bg-gray-50'>
      <div className='max-w-2xl mx-auto'>

        {/* Header */}
        <div className='mb-8 text-center'>
          <h1 className='text-3xl font-semibold text-[var(--accent)] mb-2'>Secure Payment</h1>
          <p className='text-gray-600'>Complete your payment to confirm order</p>
        </div>

        {/* Order Summary Box */}
        <div className='brand-surface p-6 rounded-lg mb-6'>
          <h2 className='font-semibold text-lg mb-4'>Order Summary</h2>
          <div className='space-y-2 text-sm'>
            <div className='flex justify-between'>
              <span className='text-gray-600'>Amount to Pay:</span>
              <span className='font-bold text-lg text-[var(--accent-strong)]'>{formatPrice(paymentData.totalInr, '₹')}</span>
            </div>
            <div className='flex justify-between text-gray-600'>
              <span>Payment Method:</span>
              <span className='font-semibold'>{paymentData.paymentMethod}</span>
            </div>
            {(paymentData.paymentMethod === 'UPI' || paymentData.paymentMethod === 'CARD') && (
              <div className='bg-green-50 border border-green-200 rounded p-3 mt-3'>
                <p className='text-sm font-semibold text-green-800'>🎉 Payment Discount Applied!</p>
                <p className='text-green-700'>You save ₹60 on this order</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Form */}
        <div className='bg-white p-8 rounded-lg shadow-md'>

          {step === 'details' && (
            <form onSubmit={handleDetailsSubmit} className='space-y-6'>
              <h2 className='text-xl font-semibold mb-6'>Enter {paymentData.paymentMethod} Details</h2>

              {paymentData.paymentMethod === 'UPI' ? (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>UPI ID</label>
                  <input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
                  />
                  <p className='text-xs text-gray-500 mt-2'>Example: john@okhdfcbank or john@paytm</p>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Card Number</label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      maxLength="19"
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-2'>Expiry Date (MM/YY)</label>
                    <input
                      type="text"
                      placeholder="12/25"
                      value={expiryDate}
                      onChange={handleExpiryDateChange}
                      maxLength="5"
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
                    />
                  </div>
                </div>
              )}

              <p className='text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-200'>
                ℹ️ This is a dummy payment form. Enter any valid {paymentData.paymentMethod} format details to proceed.
              </p>

              <button
                type="submit"
                className='brand-button w-full py-3 rounded-lg font-semibold transition'
              >
                Continue to PIN Entry
              </button>
            </form>
          )}

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} className='space-y-6'>
              <h2 className='text-xl font-semibold mb-6'>Enter {paymentData.paymentMethod === 'UPI' ? 'UPI' : 'Card'} PIN</h2>

              <div className='text-center p-4 bg-[var(--accent-tint)] rounded-lg border border-[var(--line-soft)] mb-4'>
                <p className='text-sm text-[var(--accent-strong)]'>
                  Amount: <span className='font-bold text-lg'>{formatPrice(paymentData.totalInr, '₹')}</span>
                </p>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Enter {paymentData.paymentMethod === 'UPI' ? 'UPI' : 'Card'} PIN</label>
                <input
                  type="password"
                  placeholder="••••"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  maxLength="6"
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-center text-2xl tracking-widest'
                />
                <p className='text-xs text-gray-500 mt-2'>Enter 4-6 digit PIN</p>
              </div>

              <p className='text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-200'>
                ℹ️ For testing: Enter any 4-6 digits as PIN.
              </p>

              <div className='flex gap-3'>
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className='flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition'
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className='brand-button flex-1 py-3 rounded-lg font-semibold transition disabled:opacity-50'
                >
                  {loading ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className='text-center space-y-4'>
              <div className='flex justify-center mb-4'>
                <div className='relative'>
                  <div className='absolute inset-0 bg-green-200 rounded-full animate-pulse'></div>
                  <div className='relative bg-green-500 text-white rounded-full w-20 h-20 flex items-center justify-center'>
                    <svg className='w-10 h-10' fill='currentColor' viewBox='0 0 20 20'>
                      <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' />
                    </svg>
                  </div>
                </div>
              </div>
              <h2 className='text-2xl font-bold text-green-600'>Payment Successful!</h2>
              <p className='text-gray-600'>Your order has been confirmed.</p>
              <p className='text-sm text-gray-500'>Redirecting to order details...</p>
            </div>
          )}

        </div>

        {/* Security Info */}
        <div className='mt-6 p-4 bg-gray-100 rounded-lg text-center text-sm text-gray-600'>
          🔒 Secure payment gateway. Your data is encrypted and protected.
        </div>

      </div>
    </div>
  )
}

export default PaymentPage
