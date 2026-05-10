import Link from "next/link";
import connectDB from "@/config/db";
import Product from "@/models/Product";
import { buildCatalogSummaryPipeline } from "@/lib/productApi";
import { isCatalogProductVisible } from "@/lib/productVariantRules";
import { CURATED_HOME_PRODUCT_NAMES } from "@/lib/productCatalog";
import HeaderSlider from "@/components/HeaderSlider";
import HomeProducts from "@/components/HomeProducts";
import Banner from "@/components/Banner";
import NewsLetter from "@/components/NewsLetter";
import FeaturedProduct from "@/components/FeaturedProduct";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Chatbot from "@/components/Chatbot";
import SupportFeedbackBox from "@/components/SupportFeedbackBox";
import { isDatabaseConnectionError } from "@/lib/errorHandler";

export const revalidate = 30;

const serializeCatalogProducts = (products = []) =>
  products.map((product) => ({
    ...product,
    _id: String(product?._id ?? "")
  }));

const getHomePreviewProducts = async () => {
  try {
    await connectDB();

    const products = await Product.aggregate([
      {
        $match: {
          name: { $in: CURATED_HOME_PRODUCT_NAMES }
        }
      },
      ...buildCatalogSummaryPipeline()
    ]);

    return serializeCatalogProducts(products.filter(isCatalogProductVisible));
  } catch (error) {
    if (!isDatabaseConnectionError(error)) {
      console.error("Home catalog preload failed:", error.message);
    }
    return [];
  }
};

export default async function Home() {
  const initialProducts = await getHomePreviewProducts();

  return (
    <>
      <Navbar />
      <div className="px-6 md:px-16 lg:px-32 pt-2">
        <HeaderSlider />
        <HomeProducts initialProducts={initialProducts} />
        <FeaturedProduct initialProducts={initialProducts} />
        <Banner />

        <div className="my-16 rounded-[2rem] border border-[var(--line-soft)] bg-[linear-gradient(135deg,#f8f4ec_0%,#e8eee3_100%)] p-8 shadow-[0_18px_40px_rgba(77,87,74,0.08)] md:p-12">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <span className="brand-tag mb-4 inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em]">
                SageCart support
              </span>
              <h2 className="mb-4 text-3xl font-bold text-[var(--ink-900)] md:text-4xl">Need Help?</h2>
              <p className="text-[var(--ink-500)]">
                The support experience now matches the calmer storefront, with clear help for orders, shipping, returns, and more.
              </p>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <Link
                href="/help"
                className="cursor-pointer rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-6 shadow-sm transition hover:-translate-y-1"
              >
                <div className="mb-3 text-3xl text-[var(--accent-strong)]">Chat</div>
                <h3 className="mb-2 font-bold text-[var(--ink-900)]">Chat with Us</h3>
                <p className="mb-4 text-sm text-[var(--ink-500)]">Get instant answers from the built-in support assistant whenever you need help.</p>
              </Link>

              <Link
                href="/help"
                className="cursor-pointer rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-6 shadow-sm transition hover:-translate-y-1"
              >
                <div className="mb-3 text-3xl text-[var(--accent-strong)]">FAQ</div>
                <h3 className="mb-2 font-bold text-[var(--ink-900)]">Common Questions</h3>
                <p className="mb-4 text-sm text-[var(--ink-500)]">Browse concise answers about shipping, refunds, payments, and account support.</p>
              </Link>

              <Link
                href="/contact"
                className="cursor-pointer rounded-[1.5rem] border border-[var(--line-soft)] bg-[var(--bg-panel)] p-6 shadow-sm transition hover:-translate-y-1"
              >
                <div className="mb-3 text-3xl text-[var(--accent-strong)]">Care</div>
                <h3 className="mb-2 font-bold text-[var(--ink-900)]">Contact Us</h3>
                <p className="mb-4 text-sm text-[var(--ink-500)]">Reach the team directly for more detailed support and order-specific questions.</p>
              </Link>
            </div>

            <div className="text-center">
              <Link href="/help" className="brand-button rounded-full px-8 py-3 font-semibold">
                Visit Help Center
              </Link>
            </div>
          </div>
        </div>

        <NewsLetter />
        <SupportFeedbackBox
          pageKey="home"
          title="What should SageCart improve?"
          subtitle="Leave one quick note about the home page, products, or checkout."
          className="mt-16"
        />
      </div>
      <Chatbot pageContext="general" />
      <Footer />
    </>
  );
}
