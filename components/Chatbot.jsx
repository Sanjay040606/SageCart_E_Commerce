'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useClerk } from '@clerk/nextjs'
import { useAppContext } from '@/context/AppContext'
import {
  ORDER_STATUSES,
  REFUND_DELAY_HOURS,
  canCancelOrder,
  canRequestReturn,
  getOrderMilestones,
  hasCanceledFlow,
  hasReturnFlow,
  isPrepaidOrder
} from '@/lib/orderLifecycle'

const BOT_NAME = 'Sage Support'

const CONTEXT_CONFIG = {
  'my-orders': {
    title: 'Order Support',
    subtitle: 'Tracking, cancellations, returns, and refunds',
    quickActions: [
      'Track my order',
      'Can I cancel before shipping?',
      'How do refunds work?',
      'Return policy'
    ]
  },
  'order-detail': {
    title: 'Delivery Assistant',
    subtitle: 'Updates for this order and after-delivery help',
    quickActions: [
      'What does this status mean?',
      'Can I cancel this order?',
      'When can I return it?',
      'Need delivery help'
    ]
  },
  contact: {
    title: 'Contact Support',
    subtitle: 'Fast answers before you send an email',
    quickActions: [
      'How can I contact support?',
      'Response time',
      'Report an issue',
      'Business hours'
    ]
  },
  about: {
    title: 'About SageCart',
    subtitle: 'Brand, policies, and how the store works',
    quickActions: [
      'What is SageCart?',
      'What makes SageCart different?',
      'Payment methods',
      'Shipping coverage'
    ]
  },
  help: {
    title: 'Support Chat',
    subtitle: 'Ask a question like you would in a real customer chat',
    quickActions: [
      'Track my order',
      'Cancel an order',
      'Return a product',
      'Refund status'
    ]
  },
  general: {
    title: 'Shopping Assistant',
    subtitle: 'Account, payments, shipping, and order help',
    quickActions: [
      'Payment methods',
      'Shipping coverage',
      'Account help',
      'Talk to support'
    ]
  }
}

const INTENTS = [
  {
    id: 'track',
    keywords: ['track', 'tracking', 'where is my order', 'order status', 'delivery status'],
    reply: [
      'You can track every order from the My Orders page.',
      'Open the order card to see its full timeline, estimated shipment date, delivery date, and refund or return progress if applicable.'
    ]
  },
  {
    id: 'cancel',
    keywords: ['cancel', 'cancellation', 'stop my order'],
    reply: [
      'Orders can be canceled only before shipment starts.',
      'If the order is still in Confirmed status, the cancel option will appear on the order page. After shipment, cancellation is locked and the order can only go through delivery and then return flow if needed.'
    ]
  },
  {
    id: 'refund',
    keywords: ['refund', 'refunded', 'refund status', 'money back'],
    reply: [
      'For prepaid orders, cancellation moves through Canceled, Refund Initiated, and then Refunded.',
      'For COD cancellations, no refund step is needed. Return refunds are completed after the return flow finishes.'
    ]
  },
  {
    id: 'return',
    keywords: ['return', 'replace', 'pickup', 'returned'],
    reply: [
      'Returns are available for 7 days after delivery.',
      'Once the return is requested from the order page, the timeline shows Return Confirmed, Out for Pickup, Returned, and Refund Completed.'
    ]
  },
  {
    id: 'payment',
    keywords: ['payment', 'upi', 'card', 'cod', 'cash on delivery'],
    reply: [
      'SageCart supports Cash on Delivery, UPI, and card payments.',
      'Prepaid orders are eligible for automatic refund flow when canceled before shipment.'
    ]
  },
  {
    id: 'delivery',
    keywords: ['delivery', 'when will it arrive', 'delivery time', 'shipping time', 'eta', 'arrive', 'delivered'],
    reply: [
      'Delivery typically takes 3 days from order placement.',
      'Orders are shipped within 24 hours, then delivered within 2-3 days depending on location.'
    ]
  },
  {
    id: 'coupon',
    keywords: ['coupon', 'promo', 'discount', 'game code'],
    reply: [
      'Only one coupon can be applied to one order.',
      'Game coupons are one-time use and only work for the user who won them. Seller promo codes work only on matching products.'
    ]
  },
  {
    id: 'contact',
    keywords: ['support', 'contact', 'email', 'agent', 'customer care'],
    reply: [
      'You can contact the team at sagecart.support@gmail.com or use the contact page for a direct message.',
      'If your issue is about an order, sharing the order ID helps support respond faster.'
    ]
  },
  {
    id: 'account',
    keywords: ['login', 'account', 'profile', 'password'],
    reply: [
      'You can manage your account through the Clerk sign-in flow used in the app.',
      'For profile or access issues, try signing in again first, then contact support if the problem continues.'
    ]
  },
  {
    id: 'brand',
    keywords: ['sagecart', 'what is sagecart', 'about', 'brand'],
    reply: [
      'SageCart is a calmer e-commerce storefront focused on clear order tracking, subtle design, and simpler shopping flows.',
      'The experience is built around readable timelines, smoother post-order support, and more polished customer communication.'
    ]
  }
]

const buildBotMessage = (parts) => parts.join(' ')

const getTimeLabel = (value) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatStatusDate = (value) => {
  if (!value) return 'Not yet'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not yet'

  return parsed.toLocaleDateString('en-GB')
}

const getIntentId = (input) => {
  const normalized = input.toLowerCase().trim()

  for (const intent of INTENTS) {
    if (intent.keywords.some((keyword) => normalized.includes(keyword))) {
      return intent.id
    }
  }

  return null
}

const Chatbot = ({ pageContext = 'general', isHelpPage = false, orderId = null, initialQuestion = null, initialQuestionKey = 0 }) => {
  const config = CONTEXT_CONFIG[pageContext] || CONTEXT_CONFIG.general
  const storageKey = `sagecart-chat-${pageContext}`
  const messageAreaRef = useRef(null)
  const initialQuestionRef = useRef(0)
  const { user, getToken } = useAppContext()

  const [globalMessages, setGlobalMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('sagecart-messages')
      if (saved) return JSON.parse(saved)
    }
    return null
  })

  const [globalIsOpen, setGlobalIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('sagecart-isopen') === 'true'
    }
    return false
  })

  const messages = globalMessages || []
  const setMessages = setGlobalMessages

  const isOpen = isHelpPage ? true : globalIsOpen
  const setIsOpen = setGlobalIsOpen

  const welcomeMessage = useMemo(() => ([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hello, I'm ${BOT_NAME}. I can help with orders, shipping, refunds, returns, coupons, and account questions.`,
      timestamp: new Date().toISOString()
    },
    {
      id: 'welcome-context',
      sender: 'bot',
      text: `You’re in ${config.title}. Ask a question below or choose one of the quick options to get started.`,
      timestamp: new Date().toISOString()
    }
  ]), [config.title])

  const [orderSupportData, setOrderSupportData] = useState({ orders: [], currentOrder: null })
  const [isTyping, setIsTyping] = useState(false)
  const [awaitingOrderSelection, setAwaitingOrderSelection] = useState(false)
  const [pendingOrderAction, setPendingOrderAction] = useState(null) // 'cancel' or 'return'
  const [queryHistory, setQueryHistory] = useState([])
  const { openSignIn } = useClerk()

  const getSupportAwareResponse = (input) => {
    const intentId = getIntentId(input)
    const activeOrder = orderSupportData.currentOrder || orderSupportData.orders[0] || null

    // Handle order selection for multiple orders with pending action
    if (awaitingOrderSelection && input.match(/^\d+$/)) {
      const orderIndex = parseInt(input) - 1
      if (orderIndex >= 0 && orderIndex < orderSupportData.orders.length) {
        const selectedOrder = orderSupportData.orders[orderIndex]
        setOrderSupportData(prev => ({ ...prev, currentOrder: selectedOrder }))
        setAwaitingOrderSelection(false)
        
        // If there's a pending action, execute it
        if (pendingOrderAction) {
          return `Processing ${pendingOrderAction} for order ${selectedOrder._id.slice(-6)}...`
        }
        
        return `Selected order ${selectedOrder._id.slice(-6)} (${selectedOrder.items?.[0]?.product?.name || 'Product'}). How can I help with this order?`
      }
      return `Please enter a valid order number (1-${orderSupportData.orders.length}).`
    }

    const orderRelatedIntents = ['track', 'cancel', 'refund', 'return', 'delivery']
    if (!user && orderRelatedIntents.includes(intentId)) {
      openSignIn()
      return 'To answer order-specific requests like tracking, cancellation, refund, or return, please sign in first. The login window has been opened for you.'
    }

    // Add to query history for cancel/return operations
    if (['cancel', 'return'].includes(intentId) && activeOrder) {
      setQueryHistory(prev => [...prev.slice(-4), {
        intent: intentId,
        orderId: activeOrder._id,
        timestamp: new Date().toISOString(),
        status: activeOrder.status
      }])
    }

    if (intentId === 'track' && activeOrder) {
      const { shippedEta, deliveryEta } = getOrderMilestones(activeOrder)

      // Show detailed order information
      const trackOrderDetails = `Order ${activeOrder._id.slice(-6)}: ${activeOrder.items?.length || 0} item(s) totaling ₹${activeOrder.amountInr || activeOrder.amount || 0}`

      if (hasCanceledFlow(activeOrder)) {
        const refundInfo = isPrepaidOrder(activeOrder)
          ? ` Refund was initiated on ${formatStatusDate(activeOrder.refundRequestedAt)} and completed on ${formatStatusDate(activeOrder.refundCompletedAt)}.`
          : ' This was a COD order with no refund required.'
        return `${trackOrderDetails} - Status: ${activeOrder.status}. Canceled on ${formatStatusDate(activeOrder.canceledAt)}.${refundInfo}`
      }

      if (hasReturnFlow(activeOrder)) {
        return `${trackOrderDetails} - Status: ${activeOrder.status}. Return process started. Check the order page for pickup and refund updates.`
      }

      if (activeOrder.status === ORDER_STATUSES.DELIVERED) {
        return `${trackOrderDetails} - Delivered on ${formatStatusDate(activeOrder.deliveredAt)}. Return available until ${formatStatusDate(getOrderMilestones(activeOrder).returnDeadline)}.`
      }

      if (activeOrder.status === ORDER_STATUSES.SHIPPED) {
        return `${trackOrderDetails} - Shipped on ${formatStatusDate(activeOrder.shippedAt || shippedEta)}. Delivery ETA: ${formatStatusDate(activeOrder.estimatedDeliveryDate || deliveryEta)}.`
      }

    if (intentId === 'delivery' && activeOrder) {
      const { shippedEta, deliveryEta } = getOrderMilestones(activeOrder)
      const deliveryOrderDetails = `Order ${activeOrder._id.slice(-6)} (${activeOrder.items?.[0]?.product?.name || 'Product'})`

      if (activeOrder.status === ORDER_STATUSES.DELIVERED) {
        return `${deliveryOrderDetails} was delivered on ${formatStatusDate(activeOrder.deliveredAt)}.`
      }

      if (activeOrder.status === ORDER_STATUSES.SHIPPED) {
        return `${deliveryOrderDetails} has been shipped and is expected to be delivered by ${formatStatusDate(activeOrder.estimatedDeliveryDate || deliveryEta)}.`
      }

      if (activeOrder.status === ORDER_STATUSES.OUT_FOR_DELIVERY) {
        return `${deliveryOrderDetails} is out for delivery today and should arrive by end of day.`
      }

      return `${deliveryOrderDetails} - Shipment ETA: ${formatStatusDate(shippedEta)}, Delivery ETA: ${formatStatusDate(activeOrder.estimatedDeliveryDate || deliveryEta)}.`
    }
      // Show order details for cancel operations
      const cancelOrderDetails = `Order ${activeOrder._id.slice(-6)} (${activeOrder.items?.[0]?.product?.name || 'Product'})`

      if (canCancelOrder(activeOrder)) {
        return `Yes, ${cancelOrderDetails} can still be canceled. It hasn't shipped yet. Open the order page and use the Cancel Order button.`
      }

      if (hasCanceledFlow(activeOrder)) {
        return `${cancelOrderDetails} is already canceled (Status: ${activeOrder.status}). ${isPrepaidOrder(activeOrder) ? 'Refund processing is in progress.' : 'COD order - no refund needed.'}`
      }

      return `${cancelOrderDetails} cannot be canceled - shipment has started. After delivery, you can request a return if still within the return window.`
    }

    if (intentId === 'refund' && activeOrder) {
      const refundOrderDetails = `Order ${activeOrder._id.slice(-6)} (${activeOrder.items?.[0]?.product?.name || 'Product'})`

      if (activeOrder.status === ORDER_STATUSES.REFUNDED) {
        return `${refundOrderDetails} - Refund completed on ${formatStatusDate(activeOrder.refundCompletedAt)}.`
      }

      if (activeOrder.status === ORDER_STATUSES.REFUND_INITIATED) {
        return `${refundOrderDetails} - Refund initiated on ${formatStatusDate(activeOrder.refundRequestedAt)}. Usually completes within ${REFUND_DELAY_HOURS} hours.`
      }

      if (hasCanceledFlow(activeOrder) && !isPrepaidOrder(activeOrder)) {
        return `${refundOrderDetails} - Canceled COD order, no refund required.`
      }

      return `${refundOrderDetails} - No active refund. ${hasCanceledFlow(activeOrder) ? 'Check order status for refund progress.' : 'Refunds only apply to canceled prepaid orders or completed returns.'}`
    }

    if (intentId === 'return' && activeOrder) {
      const returnOrderDetails = `Order ${activeOrder._id.slice(-6)} (${activeOrder.items?.[0]?.product?.name || 'Product'})`

      if (canRequestReturn(activeOrder)) {
        return `Yes, ${returnOrderDetails} can be returned. Delivered on ${formatStatusDate(activeOrder.deliveredAt)}, return available until ${formatStatusDate(getOrderMilestones(activeOrder).returnDeadline)}. Use the Request Return button on the order page.`
      }

      if (hasReturnFlow(activeOrder)) {
        return `${returnOrderDetails} is already in return process (Status: ${activeOrder.status}). Check the order page for pickup and refund updates.`
      }

      if (activeOrder.status === ORDER_STATUSES.DELIVERED) {
        return `${returnOrderDetails} was delivered on ${formatStatusDate(activeOrder.deliveredAt)}, but the 7-day return window has expired.`
      }

      return `${returnOrderDetails} - Return not available. Order must be delivered first and within the 7-day return window.`
    }

    // Handle multiple orders for order-related queries - filter based on intent
    if (orderRelatedIntents.includes(intentId) && orderSupportData.orders.length > 1 && !orderSupportData.currentOrder) {
      let relevantOrders = orderSupportData.orders
      let actionText = 'help with'

      if (intentId === 'track') {
        // Show orders that are in transit (shipped but not delivered)
        relevantOrders = relevantOrders.filter(order =>
          [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.OUT_FOR_DELIVERY].includes(order.status)
        )
        actionText = 'track'
      } else if (intentId === 'cancel') {
        // Show only orders that can be canceled
        relevantOrders = relevantOrders.filter(canCancelOrder)
        actionText = 'cancel'
      } else if (intentId === 'return') {
        // Show only orders that can be returned
        relevantOrders = relevantOrders.filter(canRequestReturn)
        actionText = 'return'
      } else if (intentId === 'refund') {
        // Show orders with refund relevance
        relevantOrders = relevantOrders.filter(order =>
          hasCanceledFlow(order) || hasReturnFlow(order)
        )
        actionText = 'check refund status for'
      }

      if (relevantOrders.length === 0) {
        const reasonMap = {
          track: 'No orders are currently in transit. Orders appear here once they are shipped.',
          cancel: 'No orders can be canceled at this time. Orders can only be canceled before they ship.',
          return: 'No orders available for return. Returns are available for 7 days after delivery.',
          refund: 'No orders with refund status. Refunds only apply to canceled prepaid orders or completed returns.'
        }
        return reasonMap[intentId] || 'No eligible orders found for this action.'
      }

      setAwaitingOrderSelection(true)
      setPendingOrderAction(intentId)
      const orderList = relevantOrders.slice(0, 5).map((order, index) =>
        `${index + 1}. Order ${order._id.slice(-6)} - ${order.items?.[0]?.product?.name || 'Product'} (${order.status}) - ${formatStatusDate(order.date)}`
      ).join('\n')

      return `You have ${relevantOrders.length} order${relevantOrders.length !== 1 ? 's' : ''} that can be ${actionText}. Which one?\n\n${orderList}\n\nReply with the order number (1-${Math.min(relevantOrders.length, 5)}).`
    }

    return intentId
      ? buildBotMessage(INTENTS.find((intent) => intent.id === intentId).reply)
      : 'I can help with orders, delivery, returns, refunds, payments, coupons, and account support. Try asking in a short sentence like "How do refunds work?" or "Can I cancel before shipping?"'
  }

  const [userInput, setUserInput] = useState('')

  useEffect(() => {
    if (!globalMessages) {
      setGlobalMessages(welcomeMessage)
    }
  }, [globalMessages, welcomeMessage, setGlobalMessages])

  useEffect(() => {
    if (globalMessages) {
      sessionStorage.setItem('sagecart-messages', JSON.stringify(globalMessages))
    }
    sessionStorage.setItem('sagecart-isopen', globalIsOpen.toString())
  }, [globalMessages, globalIsOpen])

  useEffect(() => {
    const handleUnload = () => {
      sessionStorage.removeItem('sagecart-messages')
      sessionStorage.removeItem('sagecart-isopen')
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  useEffect(() => {
    if (!user) return
    const hasWelcome = messages.some((message) => message.id === 'welcome')
    if (!hasWelcome) {
      setMessages(welcomeMessage)
    }
  }, [user, messages, welcomeMessage])

  useEffect(() => {
    const container = messageAreaRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    const loadOrderSupportData = async () => {
      if (!user) {
        setOrderSupportData({ orders: [], currentOrder: null })
        return
      }

      try {
        const token = await getToken()
        const { data } = await axios.get('/api/order/list', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!data.success) return

        const orders = (data.orders || []).slice().sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
        const currentOrder = orderId ? orders.find((order) => order._id === orderId) || null : null
        setOrderSupportData({ orders, currentOrder })
      } catch (error) {
        console.log('Unable to load chatbot order support data', error)
      }
    }

    loadOrderSupportData()
  }, [getToken, orderId, user])

  const pushMessage = (message) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        ...message
      }
    ])
  }

  const getQueryHistory = () => {
    if (queryHistory.length === 0) return null

    const recentQueries = queryHistory.slice(-3).map((query, index) => {
      const order = orderSupportData.orders.find(o => o._id === query.orderId)
      const action = query.intent === 'cancel' ? 'Cancel' : 'Return'
      const status = order?.status || query.status
      return `${index + 1}. ${action} request for order ${query.orderId.slice(-6)} - Status: ${status} (${formatStatusDate(query.timestamp)})`
    }).join('\n')

    return `Recent cancel/return queries:\n${recentQueries}`
  }

  const sendMessage = (text) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    pushMessage({ sender: 'user', text: trimmed })
    setUserInput('')
    setIsTyping(true)

    window.setTimeout(async () => {
      let response = getSupportAwareResponse(trimmed)

      // Execute pending order action if an order was selected
      if (awaitingOrderSelection && trimmed.match(/^\d+$/) && pendingOrderAction && orderSupportData.currentOrder) {
        try {
          const token = await getToken()
          const orderId = orderSupportData.currentOrder._id
          const action = pendingOrderAction === 'cancel' ? 'cancel' : 'request-return'
          
          const { data } = await axios.patch(
            `/api/order/${orderId}`,
            { action },
            { headers: { Authorization: `Bearer ${token}` } }
          )

          if (data.success) {
            const actionDisplay = pendingOrderAction === 'cancel' ? 'Cancelled' : 'Return requested'
            response = `✓ ${actionDisplay} successfully for order ${orderId.slice(-6)}. ${pendingOrderAction === 'cancel' ? 'Your refund will be processed shortly.' : 'Pickup will be arranged soon.'}`
            
            // Reload orders
            try {
              const { data: ordersData } = await axios.get('/api/order/list', {
                headers: { Authorization: `Bearer ${token}` }
              })
              if (ordersData.success) {
                const updatedOrders = (ordersData.orders || []).slice().sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
                setOrderSupportData(prev => ({
                  orders: updatedOrders,
                  currentOrder: updatedOrders.find(o => o._id === orderId) || null
                }))
              }
            } catch (error) {
              console.log('Could not reload orders after action', error)
            }
          } else {
            response = `Unable to ${pendingOrderAction}: ${data.message || 'Unknown error'}`
          }
        } catch (error) {
          response = `Unable to ${pendingOrderAction}: ${error.response?.data?.message || error.message}`
        } finally {
          setPendingOrderAction(null)
        }
      }

      // Add query history for cancel/return related responses
      if (['cancel', 'return'].includes(getIntentId(trimmed)) && queryHistory.length > 0) {
        const history = getQueryHistory()
        if (history) {
          response += `\n\n${history}`
        }
      }

      // Handle query history requests
      if (trimmed.toLowerCase().includes('query history') || trimmed.toLowerCase().includes('cancel history') || trimmed.toLowerCase().includes('return history')) {
        const history = getQueryHistory()
        response = history || 'No cancel or return queries found in recent history.'
      }

      pushMessage({
        sender: 'bot',
        text: response
      })
      setIsTyping(false)
    }, 700)
  }

  useEffect(() => {
    if (!initialQuestion) return
    if (initialQuestionKey === null) return
    if (initialQuestionRef.current === initialQuestionKey) return

    initialQuestionRef.current = initialQuestionKey
    sendMessage(initialQuestion)
  }, [initialQuestion, initialQuestionKey])

  const clearChat = () => {
    setMessages(welcomeMessage)
  }

  if (!isOpen && !isHelpPage) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--line-soft)] bg-[linear-gradient(135deg,#48624a_0%,#657f67_100%)] text-white shadow-[0_20px_40px_rgba(44,58,46,0.28)] transition hover:scale-[1.03]"
        title="Open Sage Support"
      >
        <span className="text-2xl">...</span>
      </button>
    )
  }

  return (
    <div className={`${isHelpPage ? 'w-full' : 'fixed bottom-5 right-5 z-50 h-[min(760px,calc(100vh-40px))] w-[380px]'} overflow-hidden rounded-[2rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] shadow-[0_30px_60px_rgba(42,55,43,0.16)]`}>
      <div className="border-b border-[var(--line-soft)] bg-[linear-gradient(135deg,#f8f4ec_0%,#e7ede2_100%)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-sm font-semibold text-white shadow-sm">
              SS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--ink-900)]">{BOT_NAME}</p>
                <span className="rounded-full bg-[rgba(72,98,74,0.12)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  Online
                </span>
              </div>
              <p className="text-sm text-[var(--ink-700)]">{config.title}</p>
              <p className="mt-0.5 text-xs text-[var(--ink-500)]">{config.subtitle}</p>
            </div>
          </div>

          {!isHelpPage && (
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full px-2 py-1 text-[var(--ink-500)] transition hover:bg-white/70 hover:text-[var(--ink-900)]"
            >
              x
            </button>
          )}
        </div>
      </div>

      <div
        ref={messageAreaRef}
        className={`overflow-y-auto bg-[radial-gradient(circle_at_top,#f6f1e8_0%,#fdfbf7_40%,#fbfaf6_100%)] px-4 py-4 ${isHelpPage ? 'h-[560px]' : 'h-[calc(100%-198px)]'}`}
      >
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[82%] gap-2 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${message.sender === 'user' ? 'bg-[var(--ink-900)] text-white' : 'bg-[rgba(72,98,74,0.12)] text-[var(--accent-strong)]'}`}>
                  {message.sender === 'user' ? 'You' : 'SS'}
                </div>

                <div className={`rounded-[1.5rem] px-4 py-3 shadow-sm ${message.sender === 'user' ? 'rounded-br-md bg-[linear-gradient(135deg,#48624a_0%,#68806a_100%)] text-white' : 'rounded-bl-md border border-[var(--line-soft)] bg-white text-[var(--ink-800)]'}`}>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                  <p className={`mt-2 text-[10px] ${message.sender === 'user' ? 'text-white/75' : 'text-[var(--ink-400)]'}`}>
                    {getTimeLabel(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex max-w-[82%] gap-2">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(72,98,74,0.12)] text-[10px] font-semibold text-[var(--accent-strong)]">
                  SS
                </div>
                <div className="rounded-[1.5rem] rounded-bl-md border border-[var(--line-soft)] bg-white px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-strong)]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-strong)]" style={{ animationDelay: '0.15s' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent-strong)]" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--line-soft)] bg-white px-4 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {config.quickActions.map((action) => (
            <button
              key={action}
              onClick={() => sendMessage(action)}
              className="rounded-full border border-[var(--line-soft)] bg-[var(--bg-soft)] px-3 py-2 text-xs font-medium text-[var(--ink-700)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-tint)] hover:text-[var(--ink-900)]"
            >
              {action}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 rounded-[1.35rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-3">
            <textarea
              rows={1}
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendMessage(userInput)
                }
              }}
              placeholder="Ask about orders, refunds, shipping, payments, or coupons..."
              className="max-h-28 min-h-[24px] w-full resize-none bg-transparent text-sm text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-400)]"
            />
          </div>

          <button
            onClick={() => sendMessage(userInput)}
            disabled={isTyping || !userInput.trim()}
            className="rounded-[1.2rem] bg-[var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-500)]">
          <p>Support style replies for shopping and post-order help</p>
          <button onClick={clearChat} className="font-medium text-[var(--accent-strong)] hover:underline">
            Reset chat
          </button>
        </div>
      </div>
    </div>
  )
}

export default Chatbot
