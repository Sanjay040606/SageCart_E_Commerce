"use client";

import React, { useMemo } from "react";
import { assets } from "@/assets/assets";
import Link from "next/link";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import { getCuratedHomeProducts } from "@/lib/productCatalog";
import { normalizeProductImageUrl } from "@/lib/productDisplay";

const FeaturedProduct = ({ initialProducts = [] }) => {
  const { products, productsLoading } = useAppContext();
  const sourceProducts = products.length > 0 ? products : initialProducts;
  const sourceLoading = productsLoading && sourceProducts.length === 0;
  const highlightedProducts = useMemo(() => getCuratedHomeProducts(sourceProducts, 3), [sourceProducts]);

  if (sourceLoading && highlightedProducts.length === 0) {
    return (
      <div className="mt-14">
        <div className="flex flex-col items-center">
          <p className="text-3xl font-medium">Featured Products</p>
          <div className="w-28 h-0.5 bg-[var(--accent)] mt-2"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-14 mt-12 md:px-14 px-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[2rem] border border-[var(--line-soft)] bg-white/70 shadow-sm">
              <div className="h-[420px] bg-[var(--bg-soft)] animate-pulse" />
              <div className="space-y-3 p-6">
                <div className="h-5 w-3/4 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                <div className="h-4 w-full rounded-full bg-[var(--bg-soft)] animate-pulse" />
                <div className="h-4 w-2/3 rounded-full bg-[var(--bg-soft)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (highlightedProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-14">
      <div className="flex flex-col items-center">
        <p className="text-3xl font-medium">Featured Products</p>
        <div className="w-28 h-0.5 bg-[var(--accent)] mt-2"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-14 mt-12 md:px-14 px-4">
        {highlightedProducts.map((product) => {
          const image = Array.isArray(product.image) ? product.image[0] : product.image;
          const description = String(product.description || "").trim();
          const shortDescription = description.length > 118 ? `${description.slice(0, 115).trimEnd()}...` : description;

          return (
            <div key={product._id} className="relative group overflow-hidden rounded-[2rem]">
              <Image
                src={normalizeProductImageUrl(image) || assets.box_icon}
                alt={product.name}
                className="group-hover:brightness-75 transition duration-300 w-full h-[420px] object-cover"
                width={900}
                height={1200}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
              <div className="group-hover:-translate-y-4 transition duration-300 absolute bottom-8 left-8 text-white space-y-2">
                <p className="font-medium text-xl lg:text-2xl">{product.name}</p>
                <p className="text-sm lg:text-base leading-5 max-w-60">{shortDescription}</p>
                <Link href={`/product/${product._id}`} className="flex items-center gap-1.5 bg-[var(--accent)] px-4 py-2 rounded">
                  Buy now <Image className="h-3 w-3" src={assets.redirect_icon} alt="Redirect Icon" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FeaturedProduct;
