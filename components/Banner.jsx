import React from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import Link from "next/link";

const productLink = "product/686a7073fd68cfeeddf40fcf";

const Banner = () => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between md:pl-20 py-14 md:py-0 bg-[linear-gradient(120deg,#e7eee2_0%,#f8f4ec_100%)] border border-[var(--line-soft)] my-16 rounded-[2rem] overflow-hidden shadow-[0_18px_40px_rgba(77,87,74,0.08)]">
      <Image
        className="max-w-56"
        src={assets.jbl_soundbox_image}
        alt="jbl_soundbox_image"
      />
      <div className="flex flex-col items-center justify-center text-center space-y-3 px-4 md:px-0">
        <span className="brand-tag rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em]">editor&apos;s pick</span>
        <h2 className="text-2xl md:text-3xl font-semibold max-w-[320px] text-[var(--ink-900)]">
          A calmer setup for play, sound, and downtime
        </h2>
        <p className="max-w-[360px] font-medium text-[var(--ink-500)]">
          Refined tech picks with a softer visual language and room to breathe.
        </p>
        <Link href={productLink} className="brand-button group flex items-center justify-center gap-1 px-12 py-2.5 rounded-full text-white">
          Shop feature
          <Image className="group-hover:translate-x-1 transition" src={assets.arrow_icon_white} alt="arrow_icon_white" />
        </Link>
      </div>
      <Image
        className="hidden md:block max-w-80"
        src={assets.md_controller_image}
        alt="md_controller_image"
      />
      <Image
        className="md:hidden"
        src={assets.sm_controller_image}
        alt="sm_controller_image"
      />
    </div>
  );
};

export default Banner;
