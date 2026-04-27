"use client"
import React, { Suspense, useEffect, useRef, useState } from "react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import Chatbot from "@/components/Chatbot"
import SupportQueryHistory from "@/components/SupportQueryHistory"
import { useRouter, useSearchParams } from "next/navigation"

const HelpContent = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chatSectionRef = useRef(null)
  const querySectionRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  const question = searchParams.get("q")
  const nextMode = searchParams.get("mode") || "overview"
  const isChatMode = nextMode === "chat" || Boolean(question)
  const isQueryMode = nextMode === "queries"
  const isMobileViewport = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  const initialQuestionKey = question ? `${nextMode}:${question}` : null

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)

    updateIsMobile()
    mediaQuery.addEventListener("change", updateIsMobile)
    return () => mediaQuery.removeEventListener("change", updateIsMobile)
  }, [])

  useEffect(() => {
    if (!question) return
    const cleanupHref = nextMode === "chat" ? "/help?mode=chat" : "/help"
    const cleanupTimer = window.setTimeout(() => {
      router.replace(cleanupHref, { scroll: false })
    }, 100)

    if (typeof window !== "undefined" && !window.matchMedia("(max-width: 767px)").matches) {
      const scrollTimer = window.setTimeout(() => {
        chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)

      return () => {
        window.clearTimeout(scrollTimer)
        window.clearTimeout(cleanupTimer)
      }
    }

    return () => {
      window.clearTimeout(cleanupTimer)
    }
  }, [question, nextMode, router])

  useEffect(() => {
    if (!isQueryMode) return
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) return

    const timer = window.setTimeout(() => {
      querySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)

    return () => window.clearTimeout(timer)
  }, [isQueryMode])

  const topicQueries = {
    "Orders & Tracking": "How do I track my order?",
    "Payments": "What payment methods do you accept?",
    "Returns & Refunds": "How do refunds work?",
    "Shipping": "What is your delivery timeline?",
    "Account Help": "How do I log in or manage my account?",
    "Contact Support": "How can I contact customer support?",
  }

  const faqItems = [
    {
      q: "How long does delivery take?",
      a: "Orders are scheduled for delivery within 3 days, and the delivery timeline is shown directly on the order page."
    },
    {
      q: "Can I cancel my order?",
      a: "Yes, but only before shipment. Once shipped, the order can no longer be canceled."
    },
    {
      q: "What is your return policy?",
      a: "Returns are available for 7 days after delivery, and the order page will show when the return window closes."
    },
    {
      q: "How do refunds work?",
      a: "Prepaid canceled orders move to Refund Initiated first, then complete automatically after a short delay."
    }
  ]

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const openChat = (selectedQuestion = null) => {
    if (isMobileViewport()) {
      const params = new URLSearchParams()
      params.set("mode", "chat")

      if (selectedQuestion) {
        params.set("q", selectedQuestion)
      }

      router.push(`/help?${params.toString()}`)
      return
    }

    if (selectedQuestion) {
      router.push(`/help?q=${encodeURIComponent(selectedQuestion)}`)
      window.setTimeout(() => scrollToSection(chatSectionRef), 50)
      return
    }

    scrollToSection(chatSectionRef)
  }

  const openQueries = () => {
    if (isMobileViewport()) {
      router.push("/help?mode=queries")
      return
    }

    scrollToSection(querySectionRef)
  }

  if (isMobile && isChatMode) {
    return (
      <div className="min-h-[100dvh] bg-[var(--bg-page)]">
        <Chatbot
          pageContext="help"
          isHelpPage={true}
          initialQuestion={question}
          initialQuestionKey={initialQuestionKey}
          mobileFullScreen
          helpReturnHref="/help"
        />
      </div>
    )
  }

  if (isMobile && isQueryMode) {
    return (
      <div className="min-h-[100dvh] bg-[var(--bg-page)]">
        <SupportQueryHistory mobileFullScreen helpReturnHref="/help" />
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 py-8 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="brand-surface rounded-[2rem] p-8 md:p-10">
            <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">Help center</span>
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--ink-900)] mb-3">SageCart Support</h1>
            <p className="text-[var(--ink-500)] max-w-3xl">
              Answers, guidance, quick order help, and a query board for cancel or return requests live together here.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openChat()}
                className="brand-button rounded-full px-5 py-3 text-sm font-semibold"
              >
                Open chat
              </button>
              <button
                type="button"
                onClick={openQueries}
                className="rounded-full border border-[var(--line-soft)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)]"
              >
                View query board
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(topicQueries).map((topic) => (
              <button
                key={topic}
                onClick={() => openChat(topicQueries[topic] || topic)}
                className="brand-surface rounded-[1.5rem] p-5 text-left transition hover:-translate-y-1"
              >
                <p className="text-sm font-semibold text-[var(--accent-strong)]">Quick topic</p>
                <h3 className="mt-2 text-lg font-bold text-[var(--ink-900)]">{topic}</h3>
                <p className="mt-2 text-sm text-[var(--ink-500)]">{topicQueries[topic]}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-8 items-start">
            <div ref={chatSectionRef} className="space-y-6">
              <div className="brand-surface rounded-[2rem] p-6 md:p-8">
                <h2 className="text-2xl font-bold text-[var(--ink-900)] mb-3">Ask Our Support Bot</h2>
                <p className="text-[var(--ink-500)] mb-4">Use the bot for tracking, canceling, returns, refunds, and policy questions.</p>
                <Chatbot
                  pageContext="help"
                  isHelpPage={true}
                  initialQuestion={question}
                  initialQuestionKey={initialQuestionKey}
                />
              </div>

              <div className="brand-surface rounded-[2rem] p-8">
                <h2 className="text-2xl font-bold text-[var(--ink-900)] mb-6">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {faqItems.map((faq) => (
                    <details key={faq.q} className="border-l-4 border-[var(--accent)] pl-4 py-2 cursor-pointer">
                      <summary className="font-semibold text-[var(--ink-900)] hover:text-[var(--accent-strong)]">
                        {faq.q}
                      </summary>
                      <p className="text-[var(--ink-500)] mt-2">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>

            <div ref={querySectionRef} className="space-y-6">
              <SupportQueryHistory onOpenChat={openChat} />

              <div className="bg-[linear-gradient(135deg,#f8f4ec_0%,#e8eee3_100%)] rounded-[2rem] shadow-sm p-6 border border-[var(--line-soft)]">
                <h3 className="text-lg font-bold text-[var(--ink-900)] mb-4">Need More Help?</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold text-[var(--ink-900)]">Email</p>
                    <p className="text-[var(--ink-500)]">sagecart.support@gmail.com</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--ink-900)]">Hours</p>
                    <p className="text-[var(--ink-500)]">Every day for chat guidance</p>
                    <p className="text-[var(--ink-500)]">Manual support during business hours</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

export default function Help() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[var(--bg-page)]" />}>
      <HelpContent />
    </Suspense>
  )
}
