'use client'
import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Chatbot from "@/components/Chatbot";

const values = [
  {
    title: "Clarity",
    text: "We keep the shopping flow understandable, from product pages to order timelines and refund states."
  },
  {
    title: "Calm Design",
    text: "The interface is intentionally quieter, softer, and easier to return to than loud marketplace templates."
  },
  {
    title: "Trust",
    text: "Status updates, payments, shipping, and returns are shown with clear timing instead of vague messages."
  },
  {
    title: "Care",
    text: "Support should feel helpful and human, not like an afterthought added at the end."
  }
]

const About = () => {
  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 py-12">
        <div className="brand-surface rounded-[2rem] p-8 md:p-12 mb-10">
          <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">About SageCart</span>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-[var(--ink-900)]">
            A storefront shaped by your own changes
          </h1>
          <p className="text-lg text-[var(--ink-500)] max-w-3xl mb-4">
            SageCart is no longer just the original repo. It has been reshaped into a calmer shopping project with clearer order states, softer branding, and a more personal design direction.
          </p>
          <p className="text-lg text-[var(--ink-500)] max-w-3xl">
            The goal is simple: make shopping feel less noisy, more reliable, and easier to trust from browse to delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.9fr] gap-8 mb-10">
          <div className="brand-surface rounded-[2rem] p-8">
            <h2 className="text-3xl font-bold mb-5 text-[var(--ink-900)]">Our Direction</h2>
            <p className="text-[var(--ink-500)] leading-7">
              SageCart focuses on curated product discovery, cleaner checkout experiences, and order tracking that actually explains what is happening. Instead of generic marketplace energy, it leans into subtle color, softer spacing, and readable status messaging.
            </p>
          </div>

          <div className="bg-[linear-gradient(135deg,#f8f4ec_0%,#e8eee3_100%)] border border-[var(--line-soft)] rounded-[2rem] p-8">
            <h2 className="text-2xl font-bold mb-5 text-[var(--ink-900)]">What Changed</h2>
            <ul className="space-y-3 text-[var(--ink-500)]">
              <li>New brand direction with SageCart naming</li>
              <li>Subtle sage and stone color palette</li>
              <li>Cleaner order, refund, and return lifecycle handling</li>
              <li>More cohesive support and storefront experience</li>
            </ul>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-8 text-[var(--ink-900)]">Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {values.map((value) => (
              <div key={value.title} className="brand-surface rounded-[1.75rem] p-6">
                <h3 className="text-xl font-semibold mb-3 text-[var(--ink-900)]">{value.title}</h3>
                <p className="text-[var(--ink-500)]">{value.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Chatbot pageContext="about" />
      <Footer />
    </>
  );
};

export default About;
