'use client'
import React from "react";
import HeaderSlider from "@/components/HeaderSlider";
import HomeProducts from "@/components/HomeProducts";
import Banner from "@/components/Banner";
import NewsLetter from "@/components/NewsLetter";
import FeaturedProduct from "@/components/FeaturedProduct";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
import Chatbot from "@/components/Chatbot";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";

const Home = () => {
  const { productsLoading } = useAppContext();
  const router = useRouter();

  if (productsLoading) {
    return <Loading />;
  }

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 pt-2">
        <HeaderSlider />
        <HomeProducts />
        <FeaturedProduct />
        <Banner />

        <div className="my-16 bg-[linear-gradient(135deg,#f8f4ec_0%,#e8eee3_100%)] border border-[var(--line-soft)] rounded-[2rem] p-8 md:p-12 shadow-[0_18px_40px_rgba(77,87,74,0.08)]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">SageCart support</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--ink-900)] mb-4">Need Help?</h2>
              <p className="text-[var(--ink-500)]">
                The support experience now matches the calmer storefront, with clear help for orders, shipping, returns, and more.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div
                className="bg-[var(--bg-panel)] rounded-[1.5rem] p-6 shadow-sm border border-[var(--line-soft)] cursor-pointer hover:-translate-y-1 transition"
                onClick={() => router.push('/help')}
              >
                <div className="text-3xl mb-3 text-[var(--accent-strong)]">Chat</div>
                <h3 className="font-bold text-[var(--ink-900)] mb-2">Chat with Us</h3>
                <p className="text-[var(--ink-500)] text-sm mb-4">Get instant answers from the built-in support assistant whenever you need help.</p>
              </div>

              <div
                className="bg-[var(--bg-panel)] rounded-[1.5rem] p-6 shadow-sm border border-[var(--line-soft)] cursor-pointer hover:-translate-y-1 transition"
                onClick={() => router.push('/help')}
              >
                <div className="text-3xl mb-3 text-[var(--accent-strong)]">FAQ</div>
                <h3 className="font-bold text-[var(--ink-900)] mb-2">Common Questions</h3>
                <p className="text-[var(--ink-500)] text-sm mb-4">Browse concise answers about shipping, refunds, payments, and account support.</p>
              </div>

              <div
                className="bg-[var(--bg-panel)] rounded-[1.5rem] p-6 shadow-sm border border-[var(--line-soft)] cursor-pointer hover:-translate-y-1 transition"
                onClick={() => router.push('/contact')}
              >
                <div className="text-3xl mb-3 text-[var(--accent-strong)]">Care</div>
                <h3 className="font-bold text-[var(--ink-900)] mb-2">Contact Us</h3>
                <p className="text-[var(--ink-500)] text-sm mb-4">Reach the team directly for more detailed support and order-specific questions.</p>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={() => router.push('/help')}
                className="brand-button px-8 py-3 rounded-full font-semibold"
              >
                Visit Help Center
              </button>
            </div>
          </div>
        </div>

        <NewsLetter />
      </div>
      <Chatbot pageContext="general" />
      <Footer />
    </>
  );
};

export default Home;
