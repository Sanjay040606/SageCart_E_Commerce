'use client'
import { jsPDF } from 'jspdf'
import { convertUSDToINR } from '@/lib/currencyUtils'
import toast from 'react-hot-toast'

const formatPriceForPDF = (amount) => {
  return `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`
}

const getItemName = (item) => {
  if (!item) return 'Product'
  if (item.product && typeof item.product === 'object') return item.product.name || item.product.title || 'Product'
  if (item.productName) return item.productName
  if (item.name) return item.name
  if (item.product && typeof item.product === 'string') return item.product
  return item.title || 'Product'
}

const getItemOfferPrice = (item) => {
  if (!item) return 0
  if (item.product && typeof item.product === 'object' && item.product.offerPrice != null) {
    return convertUSDToINR(item.product.offerPrice)
  }
  if (item.offerPriceInr != null) return Number(item.offerPriceInr)
  if (item.offerPrice != null) return Number(item.offerPrice)
  if (item.price != null) return Number(item.price)
  return 0
}

export const downloadInvoicePDF = (invoicePayload) => {
  if (!invoicePayload) return

  try {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 15

    const invoiceData = invoicePayload.order || invoicePayload
    const displayItems = invoicePayload.items || invoiceData.items || []
    const address = invoicePayload.address || invoiceData.address || {}

    const invoiceId = invoiceData._id || (invoicePayload.order && invoicePayload.order._id) || 'N/A'
    const invoiceDate = invoiceData.date ? new Date(invoiceData.date) : new Date()
    const paymentMethod = invoiceData.paymentMethod || invoicePayload.paymentMethod || 'COD'

    const subTotalInr = invoicePayload.offerSubTotalInr ?? invoicePayload.subTotalInr ?? invoiceData.subTotalInr ?? 0
    const offerSubTotalInr = invoicePayload.offerSubTotalInr ?? invoiceData.subTotalInr ?? 0
    const discountInr = invoicePayload.discountInr ?? invoiceData.discountInr ?? 0
    const paymentDiscountInr = invoicePayload.paymentDiscountInr ?? invoiceData.paymentDiscountInr ?? 0
    const shippingInr = invoicePayload.shippingInr ?? invoiceData.shippingInr ?? 0
    const totalOrderAmount = invoicePayload.amountInr ?? invoicePayload.totalInr ?? invoiceData.amountInr ?? 0

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('SageCart', 14, yPosition)

    doc.setFontSize(28)
    doc.text('INVOICE', pageWidth - 18, yPosition, { align: 'right' })
    yPosition += 10

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Invoice Number: ${String(invoiceId).slice(-6).toUpperCase()}`, 14, yPosition)
    doc.text(`Date: ${invoiceDate.toLocaleDateString()}`, pageWidth - 14, yPosition, { align: 'right' })
    yPosition += 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Bill From:', 14, yPosition)
    doc.text('Bill To:', pageWidth / 2 + 10, yPosition)
    yPosition += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const fromLines = ['SageCart', 'Customer Support Desk', 'India', 'Email: sagecart.support@gmail.com']
    const toLines = [
      address.fullName || 'Customer',
      address.area || '',
      `${address.city || ''}${address.city && address.state ? ', ' : ''}${address.state || ''}`,
      `Phone: ${address.phoneNumber || 'N/A'}`
    ]

    for (let i = 0; i < 4; i++) {
      if (fromLines[i]) doc.text(fromLines[i], 14, yPosition)
      if (toLines[i]) doc.text(toLines[i], pageWidth / 2 + 10, yPosition)
      yPosition += 5
    }

    yPosition += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('ORDER DETAILS', 14, yPosition)
    yPosition += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const orderInfo = [
      `Order ID: ${invoiceId}`,
      `Date: ${invoiceDate.toLocaleDateString()} ${invoiceDate.toLocaleTimeString()}`,
      `Status: ${invoiceData.status || invoicePayload.status || 'Confirmed'}`,
      `Payment Method: ${paymentMethod}`
    ]

    orderInfo.forEach(info => {
      doc.text(info, 14, yPosition)
      yPosition += 5
    })

    yPosition += 3
    doc.setDrawColor(220, 220, 220)
    doc.line(14, yPosition, pageWidth - 14, yPosition)
    yPosition += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('ITEMIZED DETAILS', 14, yPosition)
    yPosition += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    const colWidths = { sno: 10, name: 60, qty: 15, price: 25, tax: 20, total: 25 }
    doc.text('S.No', 14, yPosition)
    doc.text('Item', 14 + colWidths.sno + 5, yPosition)
    doc.text('Qty', 14 + colWidths.sno + colWidths.name + 5, yPosition)
    doc.text('Rate', 14 + colWidths.sno + colWidths.name + colWidths.qty + 8, yPosition)
    doc.text('Tax', 14 + colWidths.sno + colWidths.name + colWidths.qty + colWidths.price + 10, yPosition)
    doc.text('Amount', 14 + colWidths.sno + colWidths.name + colWidths.qty + colWidths.price + colWidths.tax + 15, yPosition)

    yPosition += 6
    doc.setDrawColor(200, 200, 200)
    doc.line(14, yPosition, pageWidth - 14, yPosition)
    yPosition += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)

    displayItems.forEach((item, idx) => {
      const qty = item.quantity || 1
      const itemName = getItemName(item)
      const price = getItemOfferPrice(item)
      const itemTotal = price * qty
      const taxAmount = Math.round(itemTotal * 0.18)

      const wrappedName = doc.splitTextToSize(itemName, colWidths.name)
      const nameHeight = wrappedName.length * 4

      if (yPosition + nameHeight + 5 > pageHeight - 20) {
        doc.addPage()
        yPosition = 15
      }

      doc.text(String(idx + 1), 14, yPosition)
      doc.text(wrappedName, 14 + colWidths.sno + 5, yPosition)
      doc.text(String(qty), 14 + colWidths.sno + colWidths.name + 5, yPosition)
      doc.text(formatPriceForPDF(price), 14 + colWidths.sno + colWidths.name + colWidths.qty + 8, yPosition)
      doc.text(formatPriceForPDF(taxAmount), 14 + colWidths.sno + colWidths.name + colWidths.qty + colWidths.price + 10, yPosition)
      doc.text(formatPriceForPDF(itemTotal + taxAmount), 14 + colWidths.sno + colWidths.name + colWidths.qty + colWidths.price + colWidths.tax + 15, yPosition)

      yPosition += Math.max(nameHeight, 5)
    })

    yPosition += 3
    doc.setDrawColor(200, 200, 200)
    doc.line(14, yPosition, pageWidth - 14, yPosition)
    yPosition += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('BILL SUMMARY', 14, yPosition)
    yPosition += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    const summaryData = [
      { label: 'Subtotal (Original)', value: formatPriceForPDF(invoicePayload.subTotalInr ?? invoiceData.subTotalInr ?? ((invoicePayload.offerSubTotalInr || invoiceData.offerSubTotalInr || 0) + (invoicePayload.discountInr || 0))), rightX: pageWidth - 30 },
      { label: 'Subtotal (After Offer)', value: formatPriceForPDF(invoicePayload.offerSubTotalInr ?? invoiceData.offerSubTotalInr ?? invoiceData.subTotalInr), rightX: pageWidth - 30 }
    ]

    if (discountInr > 0) {
      summaryData.push({ label: 'Coupon Discount', value: `-${formatPriceForPDF(discountInr)}`, rightX: pageWidth - 30 })
    }
    
    summaryData.push({ label: 'Shipping Fee', value: shippingInr === 0 ? 'Free' : formatPriceForPDF(shippingInr), rightX: pageWidth - 30 })
    
    // Always show UPI/Card Discount for UPI/CARD payments
    const upiCardDiscount = (paymentMethod === 'UPI' || paymentMethod === 'CARD') ? (paymentDiscountInr || 60) : 0
    if (upiCardDiscount > 0) {
      summaryData.push({ label: 'UPI/Card Discount', value: `-${formatPriceForPDF(upiCardDiscount)}`, rightX: pageWidth - 30 })
    }

    summaryData.forEach((item) => {
      doc.text(item.label + ':', 14, yPosition)
      doc.text(item.value, item.rightX, yPosition, { align: 'right' })
      yPosition += 5
    })

    yPosition += 3
    doc.setDrawColor(100, 100, 100)
    doc.line(14, yPosition, pageWidth - 14, yPosition)
    yPosition += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)

    doc.text('TOTAL AMOUNT:', 14, yPosition)
    doc.text(formatPriceForPDF(totalOrderAmount), pageWidth - 30, yPosition, { align: 'right' })
    yPosition += 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('SHIPPING ADDRESS', 14, yPosition)
    yPosition += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)

    if (address) {
      const addressText = [
        address.fullName,
        address.area,
        `${address.city || ''}${address.city && address.state ? ', ' : ''}${address.state || ''}`,
        address.postalCode || ''
      ]

      addressText.forEach((line) => {
        if (line) {
          doc.text(line, 14, yPosition)
          yPosition += 4
        }
      })
    }

    yPosition += 6
    doc.setDrawColor(200, 200, 200)
    doc.line(14, yPosition, pageWidth - 14, yPosition)
    yPosition += 8

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('Thank you for your order! For any queries, visit our Help Center.', 14, yPosition)

    const filename = `invoice-${invoiceId}.pdf`
    doc.save(filename)
    toast.success('Invoice downloaded successfully')
  } catch (error) {
    toast.error('Invoice download failed: ' + (error.message || error))
  }
}
