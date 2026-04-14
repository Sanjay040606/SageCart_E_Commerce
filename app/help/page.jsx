'use client'
import React, { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Chatbot from '@/components/Chatbot'

const Help = () => {
  const [topicMessage, setTopicMessage] = useState(null)
  const [topicTrigger, setTopicTrigger] = useState(0)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const question = urlParams.get('q')
    if (question) {
      // Auto-send into chatbot
      setTopicMessage(question)
      setTopicTrigger(1)
    }
  }, [])

  const topicQueries = {
    'Orders & Tracking': 'How do I track my order?',
    'Payments': 'What payment methods do you accept?',
    'Returns & Refunds': 'How do refunds work?',
    'Shipping': 'What is your delivery timeline?',
    'Account Help': 'How do I log in or manage my account?',
    'Contact Support': 'How can I contact customer support?'
  }

  const faqItems = [
    {
      q: 'How long does delivery take?',
      a: 'Orders are scheduled for delivery within 3 days, and the delivery timeline is shown directly on the order page.'
    },
    {
      q: 'Can I cancel my order?',
      a: 'Yes, but only before shipment. Once shipped, the order can no longer be canceled.'
    },
    {
      q: 'What is your return policy?',
      a: 'Returns are available for 7 days after delivery, and the order page will show when the return window closes.'
    },
    {
      q: 'How do refunds work?',
      a: 'Prepaid canceled orders move to Refund Initiated first, then complete automatically after a short delay.'
    }
  ]

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 py-8 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="brand-surface rounded-[2rem] p-8 md:p-10 mb-8">
            <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">Help center</span>
            <h1 className="text-4xl font-bold text-[var(--ink-900)] mb-2">SageCart Support</h1>
            <p className="text-[var(--ink-500)]">Answers, guidance, and quick order help in one calm place.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="brand-surface rounded-[2rem] p-6 md:p-8">
                <h2 className="text-2xl font-bold text-[var(--ink-900)] mb-3">Ask Our Support Bot</h2>
                <p className="text-[var(--ink-500)] mb-4">Ask about orders, shipping, returns, refunds, account help, or general storefront questions.</p>
                  <Chatbot pageContext="help" isHelpPage={true} initialQuestion={topicMessage} initialQuestionKey={topicTrigger} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="brand-surface rounded-[2rem] p-6">
                <h3 className="text-lg font-bold text-[var(--ink-900)] mb-4">Popular Topics</h3>
                <div className="space-y-2">
                  {[
                    'Orders & Tracking',
                    'Payments',
                    'Returns & Refunds',
                    'Shipping',
                    'Account Help',
                    'Contact Support'
                  ].map((topic) => (
                    <button
                      key={topic}
                      onClick={() => {
                        setTopicMessage(topicQueries[topic] || topic)
                        setTopicTrigger((prev) => prev + 1)
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--ink-700)] bg-white/75 hover:bg-[var(--accent-tint)] rounded-[1rem] border border-[var(--line-soft)] transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

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

          <div className="mt-12 brand-surface rounded-[2rem] p-8">
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
      </div>
      <Footer />
    </>
  )
}

export default Help
