'use client'
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useClerk } from '@clerk/nextjs'
import { useAppContext } from '@/context/AppContext'
import { assets } from '@/assets/assets'
import Image from 'next/image'
import {
  ORDER_STATUSES,
  canCancelOrder,
  canRequestReturn,
  getOrderMilestones,
  hasCanceledFlow,
  hasReturnFlow,
  isPrepaidOrder
} from '@/lib/orderLifecycle'
import { getOrderPaymentStateLabel, getOrderSummaryStatusLabel } from '@/lib/orderDisplay'
import {
  SUPPORT_ACTIONS,
  SUPPORT_ACTION_LABELS,
  getActionUnavailableReason,
  getEligibleSupportOrders,
  getOrderSupportTitle,
  getRefundSummaryText,
  getShortOrderId,
  getSupportActionStatus,
  getSupportActionSummary
} from '@/lib/supportCenter'
import {
  createSupportHistoryItem,
  loadSupportHistory,
  resolveSupportHistoryFromOrders,
  SUPPORT_HISTORY_EVENT,
  upsertSupportHistoryItem
} from '@/lib/supportHistory'

const BOT_NAME = 'Sage Support'

const CONTEXT_CONFIG = {
  'my-orders': {
    title: 'Order Support',
    subtitle: 'Tracking, cancellations, returns, and refunds',
    quickActions: ['Track order', 'Refund status', 'Cancel order', 'Return order', 'Query history']
  },
  'order-detail': {
    title: 'Delivery Assistant',
    subtitle: 'Updates for this order and after-delivery help',
    quickActions: ['Track order', 'Refund status', 'Cancel order', 'Return order', 'Query history']
  },
  contact: {
    title: 'Contact Support',
    subtitle: 'Fast answers before you send an email',
    quickActions: ['Track order', 'Refund status', 'Cancel order', 'Return order']
  },
  about: {
    title: 'About SageCart',
    subtitle: 'Brand, policies, and how the store works',
    quickActions: ['Track order', 'Refund status', 'Cancel order', 'Return order']
  },
  help: {
    title: 'Support Chat',
    subtitle: 'Ask a question like you would in a real customer chat',
    quickActions: ['Track order', 'Refund status', 'Cancel order', 'Return order', 'Query history']
  },
  general: {
    title: 'Shopping Assistant',
    subtitle: 'Account, payments, shipping, and order help',
    quickActions: ['Track order', 'Refund status', 'Cancel order', 'Return order', 'Query history']
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

const getTimeLabel = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatStatusDate = (value) => {
  if (!value) return 'Not yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not yet'
  return parsed.toLocaleDateString('en-GB')
}

const normalizeCommand = (value) => String(value || '').toLowerCase().trim().replace(/\s+/g, ' ')

const isAffirmative = (value) => {
  const normalized = normalizeCommand(value)
  return ['yes', 'confirm', 'confirm cancel', 'confirm return', 'proceed', 'go ahead', 'do it', 'sure'].some((token) => normalized === token || normalized.startsWith(`${token} `))
}

const isNegative = (value) => {
  const normalized = normalizeCommand(value)
  return ['no', 'cancel', 'stop', 'back', 'not now', 'abort', 'keep'].some((token) => normalized === token || normalized.startsWith(`${token} `))
}

const getIntentId = (input) => {
  const normalized = normalizeCommand(input)
  for (const intent of INTENTS) {
    if (intent.keywords.some((keyword) => normalized.includes(keyword))) {
      return intent.id
    }
  }
  return null
}

const isQuestionStyleInput = (value) => {
  const normalized = normalizeCommand(value)
  if (!normalized) return false

  return (
    normalized.endsWith('?')
    || /^(how|what|why|when|where|who|which|can|could|should|would|do|does|did|is|are|am|will|may|might)\b/.test(normalized)
    || normalized.includes('how do i')
    || normalized.includes('how can i')
    || normalized.includes('what is')
    || normalized.includes('what are')
    || normalized.includes('can i')
  )
}

const getDefaultActionButtons = () => ([
  { label: SUPPORT_ACTION_LABELS[SUPPORT_ACTIONS.TRACK], command: 'track order', variant: 'primary' },
  { label: SUPPORT_ACTION_LABELS[SUPPORT_ACTIONS.REFUND], command: 'refund status', variant: 'primary' },
  { label: SUPPORT_ACTION_LABELS[SUPPORT_ACTIONS.CANCEL], command: 'cancel order', variant: 'danger' },
  { label: SUPPORT_ACTION_LABELS[SUPPORT_ACTIONS.RETURN], command: 'return order', variant: 'danger' },
  { label: 'Query history', command: 'query history', variant: 'neutral' }
])

const getActionButtonClass = (variant = 'neutral') => {
  if (variant === 'primary') {
    return 'border-[var(--accent-strong)] bg-[var(--accent-tint)] text-[var(--ink-900)] hover:bg-[var(--accent)] hover:text-white'
  }

  if (variant === 'danger') {
    return 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  }

  return 'border-[var(--line-soft)] bg-[var(--bg-soft)] text-[var(--ink-700)] hover:bg-[var(--accent-tint)] hover:text-[var(--ink-900)]'
}

const getConfirmationButtons = (action, order) => {
  const confirmLabel = action === SUPPORT_ACTIONS.CANCEL ? 'Confirm cancel' : 'Confirm return'
  const confirmCommand = `confirm ${action} ${order._id}`

  return [
    { label: confirmLabel, command: confirmCommand, variant: 'danger' },
    {
      label: 'Choose another order',
      command: `${action} order`,
      variant: 'neutral'
    },
    { label: 'Back to menu', command: 'menu', variant: 'neutral' }
  ]
}

const getOrderFromToken = (token, orders = []) => {
  const normalized = normalizeCommand(token).replace(/^#/, '')
  if (!normalized) return null

  return orders.find((order) => {
    const orderId = normalizeCommand(order._id)
    const shortId = normalizeCommand(getShortOrderId(order._id)).replace(/^#/, '')
    return orderId === normalized || orderId.endsWith(normalized) || shortId === normalized || shortId.endsWith(normalized)
  }) || null
}

const formatOrderLine = (order) => `${getOrderSupportTitle(order)} - ${getOrderSummaryStatusLabel(order)} - ${getOrderPaymentStateLabel(order)}`

const formatOrderDetailLine = (order, action) => {
  const { shippedEta, deliveryEta, returnDeadline } = getOrderMilestones(order || {})

  if (action === SUPPORT_ACTIONS.TRACK) {
    if (order?.status === ORDER_STATUSES.DELIVERED) {
      return `Delivered on ${formatStatusDate(order.deliveredAt)}.`
    }

    if (order?.status === ORDER_STATUSES.SHIPPED) {
      return `Shipped on ${formatStatusDate(order.shippedAt || shippedEta)}. Delivery ETA ${formatStatusDate(order.estimatedDeliveryDate || deliveryEta)}.`
    }

    if (order?.status === ORDER_STATUSES.OUT_FOR_DELIVERY) {
      return `Out for delivery today. Delivery ETA ${formatStatusDate(order.estimatedDeliveryDate || deliveryEta)}.`
    }

    return `Shipment ETA ${formatStatusDate(shippedEta)}. Delivery ETA ${formatStatusDate(order.estimatedDeliveryDate || deliveryEta)}.`
  }

  if (action === SUPPORT_ACTIONS.CANCEL) {
    if (canCancelOrder(order)) {
      return 'This order can still be canceled before shipment starts.'
    }

    if (hasCanceledFlow(order)) {
      return isPrepaidOrder(order)
        ? 'This order is already canceled and the refund is processing.'
        : 'This order is already canceled.'
    }

    return 'This order cannot be canceled now because shipment has already started.'
  }

  if (action === SUPPORT_ACTIONS.RETURN) {
    if (canRequestReturn(order)) {
      return `Return is available until ${formatStatusDate(returnDeadline)}.`
    }

    if (hasReturnFlow(order)) {
      return 'This order is already in the return flow.'
    }

    return 'Return is not available yet. The order must be delivered first and still be inside the return window.'
  }

  if (action === SUPPORT_ACTIONS.REFUND) {
    return getRefundSummaryText(order)
  }

  return `Current status: ${order?.status || ORDER_STATUSES.CONFIRMED}.`
}

const formatQueryHistoryText = (entries = []) => {
  if (!entries.length) {
    return 'No saved cancel or return requests yet.'
  }

  return entries.slice(0, 5).map((entry, index) => {
    const actionLabel = SUPPORT_ACTION_LABELS[entry.action] || entry.action
    return `${index + 1}. ${actionLabel} for ${entry.productName} ${entry.orderShortId} - ${entry.status} (${formatStatusDate(entry.updatedAt || entry.createdAt)})`
  }).join('\n')
}

const Chatbot = ({ pageContext = 'general', isHelpPage = false, mobileFullScreen = false, orderId = null, initialQuestion = null, initialQuestionKey = 0, helpReturnHref = '/', onInitialQuestionConsumed = null }) => {
  const config = CONTEXT_CONFIG[pageContext] || CONTEXT_CONFIG.general
  const messageAreaRef = useRef(null)
  const initialQuestionRef = useRef(0)
  const { user, userData, getToken, router } = useAppContext()
  const { openSignIn, loaded: clerkLoaded } = useClerk()

  const [globalMessages, setGlobalMessages] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = sessionStorage.getItem('sagecart-messages')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [globalIsOpen, setGlobalIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('sagecart-isopen') === 'true'
  })
  const [orderSupportData, setOrderSupportData] = useState({ orders: [], currentOrder: null })
  const [supportFlow, setSupportFlow] = useState({
    stage: 'idle',
    action: null,
    eligibleOrders: [],
    selectedOrderId: null
  })
  const [isTyping, setIsTyping] = useState(false)
  const [userInput, setUserInput] = useState('')

  const messages = useMemo(() => globalMessages || [], [globalMessages])
  const setMessages = setGlobalMessages
  const isOpen = isHelpPage ? true : globalIsOpen
  const setIsOpen = setGlobalIsOpen

  const supportHistoryBaseEntries = useMemo(
    () => (Array.isArray(userData?.supportQueryHistory) ? userData.supportQueryHistory : []),
    [userData?.supportQueryHistory]
  )
  const userGreetingName = useMemo(() => {
    if (userData?.name) return userData.name
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    if (fullName) return fullName
    if (user?.username) return user.username
    return ''
  }, [user?.firstName, user?.lastName, user?.username, userData?.name])

  const welcomeMessage = useMemo(() => ([
    {
      id: 'welcome',
      sender: 'bot',
      text: `${userGreetingName ? `Hi ${userGreetingName}` : 'Hi there'}, I'm ${BOT_NAME}. I can help with orders, shipping, refunds, returns, coupons, and account questions.`,
      timestamp: new Date().toISOString()
    },
    {
      id: 'welcome-context',
      sender: 'bot',
      text: `You're in ${config.title}. Ask a question below or choose one of the quick options to get started.`,
      timestamp: new Date().toISOString()
    }
  ]), [config.title, userGreetingName])

  const refreshOrderSupportData = async (token) => {
    const { data } = await axios.get('/api/order/list', {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!data.success) {
      return []
    }

    const orders = (data.orders || []).slice().sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
    const currentOrder = orderId
      ? orders.find((order) => order._id === orderId) || null
      : orders[0] || null

    setOrderSupportData({ orders, currentOrder })
    resolveSupportHistoryFromOrders(orders, {
      baseEntries: supportHistoryBaseEntries,
      token
    })
    return orders
  }

  useEffect(() => {
    if (!globalMessages) {
      setGlobalMessages(welcomeMessage)
    }
  }, [globalMessages, welcomeMessage])

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
    const nextWelcomeText = welcomeMessage[0]?.text || ''
    const hasWelcome = messages.some((message) => message.id === 'welcome')
    if (!hasWelcome) {
      setMessages(welcomeMessage)
      return
    }

    const currentWelcome = messages.find((message) => message.id === 'welcome')
    if ((currentWelcome?.text || '') !== nextWelcomeText) {
      setMessages((prev) => prev.map((message) => (
        message.id === 'welcome'
          ? { ...message, text: nextWelcomeText }
          : message
      )))
    }
  }, [messages, user, welcomeMessage])

  useEffect(() => {
    const container = messageAreaRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    const loadOrderSupportData = async () => {
      if (!user) {
        setOrderSupportData({ orders: [], currentOrder: null })
        resolveSupportHistoryFromOrders([], { baseEntries: supportHistoryBaseEntries })
        return
      }

      try {
        const token = await getToken()
        await refreshOrderSupportData(token)
      } catch (error) {
        console.log('Unable to load chatbot order support data', error)
      }
    }

    loadOrderSupportData()
  }, [getToken, orderId, user])

  useEffect(() => {
    const syncSupportHistory = async () => {
      const token = user ? await getToken() : null
      resolveSupportHistoryFromOrders(orderSupportData.orders, {
        baseEntries: supportHistoryBaseEntries,
        token
      })
    }

    syncSupportHistory()
    window.addEventListener('storage', syncSupportHistory)
    window.addEventListener(SUPPORT_HISTORY_EVENT, syncSupportHistory)

    return () => {
      window.removeEventListener('storage', syncSupportHistory)
      window.removeEventListener(SUPPORT_HISTORY_EVENT, syncSupportHistory)
    }
  }, [getToken, orderSupportData.orders, supportHistoryBaseEntries, user])

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

  const getSelectedOrder = () => {
    if (supportFlow.selectedOrderId) {
      return orderSupportData.orders.find((order) => order._id === supportFlow.selectedOrderId) || null
    }

    return orderSupportData.currentOrder || orderSupportData.orders[0] || null
  }

  const buildBotResponse = (text, actions = []) => ({
    text,
    actions
  })

  const buildDefaultResponse = (overrideText = '') => buildBotResponse(
    overrideText || 'I can help with orders, shipping, refunds, returns, coupons, and account support. Choose one of the buttons below or type a short question.',
    getDefaultActionButtons()
  )

  const buildHistoryResponse = () => {
    const history = resolveSupportHistoryFromOrders(orderSupportData.orders, {
      baseEntries: supportHistoryBaseEntries
    }) || loadSupportHistory(supportHistoryBaseEntries)
    const text = history.length
      ? `Saved support requests:\n${formatQueryHistoryText(history)}`
      : 'No saved cancel or return requests yet.'

    return buildBotResponse(text, getDefaultActionButtons())
  }

  const buildOrderButtons = (action, orders) => (
    orders.slice(0, 5).map((order, index) => ({
      label: `${index + 1}. ${getOrderSupportTitle(order)}`,
      command: `select ${action} ${order._id}`,
      variant: action === SUPPORT_ACTIONS.CANCEL || action === SUPPORT_ACTIONS.RETURN ? 'danger' : 'primary'
    }))
  )

  const buildOrderListResponse = (action, orders) => {
    const actionLabel = SUPPORT_ACTION_LABELS[action] || action

    if (!user) {
      if (!clerkLoaded) {
        return buildDefaultResponse('Please wait a moment while sign-in finishes loading.')
      }

      openSignIn()
      return buildDefaultResponse('To answer order-specific requests like tracking, cancellation, refund, or return, please sign in first. The login window has been opened for you.')
    }

    if (!orders.length) {
      return buildBotResponse(getActionUnavailableReason(action), getDefaultActionButtons())
    }

    if (orders.length === 1) {
      const order = orders[0]
      setOrderSupportData((prev) => ({ ...prev, currentOrder: order }))

      if (action === SUPPORT_ACTIONS.TRACK || action === SUPPORT_ACTIONS.REFUND) {
        setSupportFlow({
          stage: 'idle',
          action,
          eligibleOrders: orders,
          selectedOrderId: order._id
        })

        return buildBotResponse(
          `${formatOrderLine(order)}\n${formatOrderDetailLine(order, action)}`,
          [
            { label: 'Back to menu', command: 'menu', variant: 'neutral' },
            { label: 'Query history', command: 'query history', variant: 'neutral' }
          ]
        )
      }

      setSupportFlow({
        stage: 'confirm',
        action,
        eligibleOrders: orders,
        selectedOrderId: order._id
      })

      return buildBotResponse(
        `${formatOrderLine(order)}\n${formatOrderDetailLine(order, action)}\n\nType YES in the message box or tap the confirm button below to finish this ${actionLabel.toLowerCase()}.`,
        getConfirmationButtons(action, order)
      )
    }

    setSupportFlow({
      stage: 'select-order',
      action,
      eligibleOrders: orders,
      selectedOrderId: null
    })

    return buildBotResponse(
      `I found ${orders.length} order${orders.length === 1 ? '' : 's'} that can be ${actionLabel.toLowerCase()}.\n\n${orders.slice(0, 5).map((order, index) => `${index + 1}. ${formatOrderLine(order)}`).join('\n')}\n\nTap a button below to continue.`,
      [
        ...buildOrderButtons(action, orders),
        { label: 'Back to menu', command: 'menu', variant: 'neutral' }
      ]
    )
  }

  const buildOrderDetailResponse = (action, order) => {
    if (!order) {
      return buildDefaultResponse()
    }

    setOrderSupportData((prev) => ({ ...prev, currentOrder: order }))

    if (action === SUPPORT_ACTIONS.CANCEL || action === SUPPORT_ACTIONS.RETURN) {
      setSupportFlow({
        stage: 'confirm',
        action,
        eligibleOrders: supportFlow.eligibleOrders.length ? supportFlow.eligibleOrders : [order],
        selectedOrderId: order._id
      })

      return buildBotResponse(
        `${formatOrderLine(order)}\n${formatOrderDetailLine(order, action)}\n\nType YES in the message box or tap the confirm button below to finish this ${SUPPORT_ACTION_LABELS[action].toLowerCase()}.`,
        getConfirmationButtons(action, order)
      )
    }

    setSupportFlow({
      stage: 'idle',
      action,
      eligibleOrders: [order],
      selectedOrderId: order._id
    })

    return buildBotResponse(
      `${formatOrderLine(order)}\n${formatOrderDetailLine(order, action)}`,
      [
        { label: 'Back to menu', command: 'menu', variant: 'neutral' },
        { label: 'Query history', command: 'query history', variant: 'neutral' }
      ]
    )
  }

  const performOrderAction = async (action, order) => {
    const token = await getToken()
    const patchAction = action === SUPPORT_ACTIONS.CANCEL ? 'cancel' : 'request-return'

    const { data } = await axios.patch(
      `/api/order/${order._id}`,
      { action: patchAction },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!data.success) {
      throw new Error(data.message || `Unable to ${action}`)
    }

    try {
      const { data: ordersData } = await axios.get('/api/order/list', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (ordersData.success) {
        const updatedOrders = (ordersData.orders || []).slice().sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
        const currentOrder = updatedOrders.find((item) => item._id === order._id) || updatedOrders[0] || null
        setOrderSupportData({
          orders: updatedOrders,
          currentOrder
        })
        resolveSupportHistoryFromOrders(updatedOrders, {
          baseEntries: supportHistoryBaseEntries,
          token
        })
        return currentOrder || order
      }
    } catch (reloadError) {
      console.log('Could not reload orders after support action', reloadError)
    }

    return data.order || order
  }

  const buildActionSuccessResponse = (action, order) => {
    if (action === SUPPORT_ACTIONS.CANCEL) {
      const refundText = isPrepaidOrder(order)
        ? 'Refund processing has started and will complete shortly.'
        : 'No refund is needed for this COD cancellation.'

      return buildBotResponse(
        `Done: ${getOrderSupportTitle(order)} was canceled successfully.\n${refundText}`,
        getDefaultActionButtons()
      )
    }

    if (action === SUPPORT_ACTIONS.RETURN) {
      return buildBotResponse(
        `Done: Return request completed for ${getOrderSupportTitle(order)}.\nThe return flow and refund updates are now saved in your query history.`,
        getDefaultActionButtons()
      )
    }

    return buildBotResponse(`Done: Updated ${getOrderSupportTitle(order)}.`, getDefaultActionButtons())
  }

  const buildGeneralIntentResponse = (intentId) => {
    const intent = INTENTS.find((item) => item.id === intentId)
    if (!intent) return buildDefaultResponse()

    return buildBotResponse(buildBotMessage(intent.reply), getDefaultActionButtons())
  }

  const generateReply = async (rawInput) => {
    const normalized = normalizeCommand(rawInput)
    if (!normalized) {
      return buildDefaultResponse()
    }

    if (normalized === 'menu' || normalized === 'support menu' || normalized === 'main menu') {
      setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
      return buildDefaultResponse()
    }

    if (normalized.includes('query history') || normalized === 'history' || normalized === 'my queries') {
      return buildHistoryResponse()
    }

    const confirmMatch = normalized.match(/^confirm\s+(cancel|return)\s+(.+)$/)
    if (confirmMatch) {
      const action = confirmMatch[1] === 'cancel' ? SUPPORT_ACTIONS.CANCEL : SUPPORT_ACTIONS.RETURN
      const token = confirmMatch[2]
      const order = getOrderFromToken(token, supportFlow.eligibleOrders.length ? supportFlow.eligibleOrders : orderSupportData.orders)

      if (!order) {
        return buildBotResponse('I could not find that order. Please choose a different one.', getDefaultActionButtons())
      }

      try {
        const updatedOrder = await performOrderAction(action, order)
        const summary = getSupportActionSummary(updatedOrder, action)
        const status = getSupportActionStatus(updatedOrder, action)
        upsertSupportHistoryItem(createSupportHistoryItem({
          action,
          order: updatedOrder,
          status,
          note: summary
        }), { token: await getToken(), baseEntries: supportHistoryBaseEntries })
        setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
        return buildActionSuccessResponse(action, updatedOrder)
      } catch (error) {
        setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
        return buildBotResponse(`Unable to complete that action: ${error?.response?.data?.message || error.message}`, getDefaultActionButtons())
      }
    }

    const selectMatch = normalized.match(/^select\s+(track|refund|cancel|return)\s+(.+)$/)
    if (selectMatch) {
      const action = selectMatch[1] === 'track'
        ? SUPPORT_ACTIONS.TRACK
        : selectMatch[1] === 'refund'
          ? SUPPORT_ACTIONS.REFUND
          : selectMatch[1] === 'cancel'
            ? SUPPORT_ACTIONS.CANCEL
            : SUPPORT_ACTIONS.RETURN
      const token = selectMatch[2]
      const eligibleOrders = supportFlow.eligibleOrders.length
        ? supportFlow.eligibleOrders
        : getEligibleSupportOrders(orderSupportData.orders, action)
      const order = getOrderFromToken(token, eligibleOrders)

      if (!order) {
        return buildBotResponse('Please choose one of the available buttons.', getDefaultActionButtons())
      }

      return buildOrderDetailResponse(action, order)
    }

    if (supportFlow.stage === 'select-order') {
      if (/^\d+$/.test(normalized)) {
        const index = parseInt(normalized, 10) - 1
        const order = supportFlow.eligibleOrders[index]
        if (order) {
          return buildOrderDetailResponse(supportFlow.action, order)
        }
      }

      const order = getOrderFromToken(normalized, supportFlow.eligibleOrders)
      if (order) {
        return buildOrderDetailResponse(supportFlow.action, order)
      }

      setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
    }

    if (supportFlow.stage === 'confirm') {
      if (isAffirmative(normalized)) {
        const order = getOrderFromToken(supportFlow.selectedOrderId, orderSupportData.orders)
        if (!order) {
          return buildBotResponse('I could not find the selected order anymore. Please choose a fresh one.', getDefaultActionButtons())
        }

        try {
          const updatedOrder = await performOrderAction(supportFlow.action, order)
          const summary = getSupportActionSummary(updatedOrder, supportFlow.action)
          const status = getSupportActionStatus(updatedOrder, supportFlow.action)
          upsertSupportHistoryItem(createSupportHistoryItem({
            action: supportFlow.action,
            order: updatedOrder,
            status,
            note: summary
          }), { token: await getToken(), baseEntries: supportHistoryBaseEntries })
          setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
          return buildActionSuccessResponse(supportFlow.action, updatedOrder)
        } catch (error) {
          setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
          return buildBotResponse(`Unable to complete that action: ${error?.response?.data?.message || error.message}`, getDefaultActionButtons())
        }
      }

      if (isNegative(normalized)) {
        setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
        return buildDefaultResponse()
      }

      setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
    }

    const intentId = getIntentId(normalized)
    if (['track', 'cancel', 'refund', 'return'].includes(intentId)) {
      const action = intentId === 'track'
        ? SUPPORT_ACTIONS.TRACK
        : intentId === 'refund'
          ? SUPPORT_ACTIONS.REFUND
          : intentId === 'cancel'
            ? SUPPORT_ACTIONS.CANCEL
            : SUPPORT_ACTIONS.RETURN

      if (isQuestionStyleInput(rawInput)) {
        return buildGeneralIntentResponse(intentId)
      }

      return buildOrderListResponse(action, getEligibleSupportOrders(orderSupportData.orders, action))
    }

    if (intentId) {
      return buildGeneralIntentResponse(intentId)
    }

    return buildDefaultResponse()
  }

  const sendMessage = (text, options = {}) => {
    const command = normalizeCommand(options.command || text)
    const displayText = (options.displayText || text || options.command || '').trim()
    if ((!command && !displayText) || isTyping) return

    pushMessage({ sender: 'user', text: displayText || command })
    setUserInput('')
    setIsTyping(true)

    window.setTimeout(async () => {
      try {
        const response = await generateReply(command || displayText)
        if (response) {
          pushMessage({
            sender: 'bot',
            text: response.text,
            actions: response.actions || []
          })
        }
      } finally {
        setIsTyping(false)
      }
    }, 450)
  }

  const clearChat = () => {
    setMessages(welcomeMessage)
    setSupportFlow({ stage: 'idle', action: null, eligibleOrders: [], selectedOrderId: null })
  }

  useEffect(() => {
    if (!initialQuestion) return
    if (initialQuestionKey === null) return
    if (initialQuestionRef.current === initialQuestionKey) return

    initialQuestionRef.current = initialQuestionKey
    sendMessage(initialQuestion)
    if (typeof onInitialQuestionConsumed === 'function') {
      onInitialQuestionConsumed()
    }
  }, [initialQuestion, initialQuestionKey, onInitialQuestionConsumed])

  if (!isOpen && !isHelpPage) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="group fixed bottom-4 right-4 z-50 flex h-[5rem] w-[5rem] items-center justify-center overflow-hidden rounded-full border border-[var(--line-soft)] bg-[linear-gradient(135deg,#48624a_0%,#657f67_100%)] text-white shadow-[0_20px_40px_rgba(44,58,46,0.28)] transition hover:scale-[1.03] sm:bottom-6 sm:right-6 sm:h-[5.25rem] sm:w-[5.25rem]"
        title="Open Sage Support"
        aria-label="Open Sage Support"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_12px_24px_rgba(0,0,0,0.2)] ring-2 ring-[rgba(199,167,106,0.26)] sm:h-16 sm:w-16">
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="h-12 w-12 drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)] sm:h-14 sm:w-14"
          >
            <defs>
              <linearGradient id="chatbotFaviconBg" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1B2520" />
                <stop offset="1" stopColor="#2A372F" />
              </linearGradient>
              <linearGradient id="chatbotFaviconGold" x1="18" y1="14" x2="42" y2="46" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F7ECD0" />
                <stop offset="0.5" stopColor="#D7BC84" />
                <stop offset="1" stopColor="#A88442" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="26" fill="url(#chatbotFaviconBg)" stroke="#C7A76A" strokeWidth="1.5" />
            <circle cx="32" cy="32" r="21" fill="none" stroke="#F7ECD0" strokeOpacity="0.16" strokeWidth="1.2" />
            <text
              x="18.5"
              y="39"
              fill="url(#chatbotFaviconGold)"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="28"
              fontWeight="700"
              letterSpacing="-0.04em"
            >
              S
            </text>
            <path
              d="M24 42.3H40"
              stroke="#F7ECD0"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.66"
            />
          </svg>
        </span>
      </button>
    )
  }

  const shellClasses = isHelpPage
    ? `${mobileFullScreen ? 'fixed inset-0 z-50 h-[100dvh] w-full sm:relative sm:z-auto sm:h-[min(760px,calc(100vh-40px))]' : 'relative w-full min-h-[36rem] h-[min(760px,calc(100vh-40px))]'}`
    : 'fixed inset-0 z-50 h-[100dvh] w-full sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(760px,calc(100vh-40px))] sm:w-[min(380px,calc(100vw-1rem))]'

  return (
    <div className={`${shellClasses} flex flex-col overflow-hidden rounded-none border border-[var(--line-soft)] bg-[var(--bg-panel)] shadow-[0_30px_60px_rgba(42,55,43,0.16)] sm:rounded-[2rem]`}>
      <div className="border-b border-[var(--line-soft)] bg-[linear-gradient(135deg,#f8f4ec_0%,#e7ede2_100%)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-fit items-center justify-start overflow-hidden rounded-[1rem] bg-white px-2 shadow-sm ring-1 ring-[rgba(199,167,106,0.16)]">
              <Image src={assets.logo} alt="SageCart" width={244} height={44} className="h-6 w-auto object-contain sm:h-7" />
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

          {isHelpPage ? (
            <button
              onClick={() => router.push(helpReturnHref)}
              className="rounded-full border border-[var(--line-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)] hover:text-[var(--ink-900)]"
            >
              Home
            </button>
          ) : (
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
        className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,#f6f1e8_0%,#fdfbf7_40%,#fbfaf6_100%)] px-4 py-4"
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

                  {message.actions?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.actions.map((action, index) => (
                        <button
                          key={`${message.id}-${index}`}
                          type="button"
                          onClick={() => sendMessage(action.command, { displayText: action.label })}
                          className={`rounded-full border px-3 py-2 text-xs font-medium transition ${getActionButtonClass(action.variant)}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
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
              type="button"
              onClick={() => sendMessage(action, { displayText: action })}
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
                  sendMessage(userInput, { displayText: userInput })
                }
              }}
              placeholder="Ask about orders, refunds, shipping, payments, or coupons..."
              className="max-h-28 min-h-[24px] w-full resize-none bg-transparent text-sm text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-400)]"
            />
          </div>

          <button
            onClick={() => sendMessage(userInput, { displayText: userInput })}
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
