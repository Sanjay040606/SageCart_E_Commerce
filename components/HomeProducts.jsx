import React, { useMemo, useState } from "react";
import ProductCard from "./ProductCard";
import { useAppContext } from "@/context/AppContext";
import { CURATED_HOME_PRODUCT_NAMES, getCuratedHomeProducts } from "@/lib/productCatalog";

const HomeProducts = () => {
  const { products, router } = useAppContext();
  const [showMore, setShowMore] = useState(false);
  const visibleProductCount = showMore ? CURATED_HOME_PRODUCT_NAMES.length : 15;
  const featuredProducts = useMemo(
    () => getCuratedHomeProducts(products, visibleProductCount),
    [products, visibleProductCount]
  );

  return (
    <div className="flex flex-col items-center pt-14">
      <p className="text-2xl font-medium text-left w-full">Popular picks</p>
      <div className="grid grid-cols-2 gap-6 mt-6 pb-14 w-full md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
        {featuredProducts.map((product) => <ProductCard key={product._id} product={product} />)}
      </div>
      <button
        onClick={() => setShowMore((prev) => !prev)}
        className="px-12 py-2.5 border rounded text-gray-500/70 hover:bg-slate-50/90 transition"
      >
        {showMore ? "Show less" : "See more"}
      </button>
      <button
        onClick={() => { router.push('/all-products') }}
        className="mt-3 text-sm text-[var(--accent-strong)] hover:underline"
      >
        View all products
      </button>
    </div>
  );
};

export default HomeProducts;
