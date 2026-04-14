'use client'
import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Chatbot from "@/components/Chatbot";
import { toast } from "react-hot-toast";
import axios from "axios";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const { data } = await axios.post('/api/contact', formData);

      if (!data.success) {
        throw new Error(data.message || "Failed to send message.");
      }

      toast.success("Message sent successfully. We’ll get back to you soon.");
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 py-12">
        <div className="text-center mb-12">
          <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">Contact SageCart</span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--ink-900)]">
            Get in Touch
          </h1>
          <p className="text-lg text-[var(--ink-500)] max-w-2xl mx-auto">
            Have a question, issue, or idea? Send a note and we’ll help you sort it out.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
          <div className="lg:col-span-1 space-y-6">
            <div className="brand-surface rounded-[2rem] p-6">
              <h3 className="text-xl font-bold mb-3 text-[var(--ink-900)]">Support</h3>
              <p className="text-[var(--ink-500)]">sagecart.support@gmail.com</p>
              <p className="text-[var(--ink-500)] mt-2">Business hours: Mon to Sat, 9:00 AM to 7:00 PM</p>
            </div>

            <div className="bg-[linear-gradient(135deg,#f8f4ec_0%,#e8eee3_100%)] border border-[var(--line-soft)] rounded-[2rem] p-6">
              <h3 className="text-xl font-bold mb-3 text-[var(--ink-900)]">Best way to contact us</h3>
              <p className="text-[var(--ink-500)]">
                Include your order ID when asking about delivery, refunds, or returns. That helps us respond faster.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="brand-surface rounded-[2rem] p-8">
              <div className="mb-6">
                <label className="block text-[var(--ink-900)] font-semibold mb-2">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full px-4 py-3 border border-[var(--line-soft)] bg-white/85 rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-[var(--ink-900)] font-semibold mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-[var(--line-soft)] bg-white/85 rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[var(--ink-900)] font-semibold mb-2">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91..."
                    className="w-full px-4 py-3 border border-[var(--line-soft)] bg-white/85 rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[var(--ink-900)] font-semibold mb-2">Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  className="w-full px-4 py-3 border border-[var(--line-soft)] bg-white/85 rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="mb-6">
                <label className="block text-[var(--ink-900)] font-semibold mb-2">Message *</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us what happened..."
                  rows="6"
                  className="w-full px-4 py-3 border border-[var(--line-soft)] bg-white/85 rounded-[1rem] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="brand-button w-full font-semibold py-3 rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>

        <div className="brand-surface rounded-[2rem] p-8">
          <h2 className="text-3xl font-bold mb-8 text-[var(--ink-900)]">Quick Answers</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[var(--ink-900)] mb-2">What is your return policy?</h3>
              <p className="text-[var(--ink-500)]">Returns are available for 7 days after delivery on eligible orders.</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--ink-900)] mb-2">How long does shipping take?</h3>
              <p className="text-[var(--ink-500)]">Orders are structured around a 3-day delivery timeline, shown on the order page.</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--ink-900)] mb-2">How can I track my order?</h3>
              <p className="text-[var(--ink-500)]">Open My Orders and select any order to see shipment, delivery, refund, and return states.</p>
            </div>
          </div>
        </div>
      </div>
      <Chatbot pageContext="contact" />
      <Footer />
    </>
  );
};

export default Contact;
