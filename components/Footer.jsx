import React from "react";
import Link from "next/link";
import Image from "next/image";
import { assets } from "@/assets/assets";

const Footer = () => {
  return (
    <footer className="mt-16 px-6 md:px-16 lg:px-32 pb-8">
      <div className="brand-surface rounded-[2rem] px-8 md:px-12 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 border-b border-[var(--line-soft)] pb-10">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <Image src={assets.logo} alt="SageCart Logo" width={160} height={50} className="object-contain" priority />
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--ink-500)]">
              SageCart is a softer shopping experience for thoughtful buys, calmer browsing,
              and a storefront that feels more personal than generic.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-[var(--ink-900)] mb-4">Explore</h3>
            <ul className="space-y-2 text-sm text-[var(--ink-500)]">
              <li><Link className="hover:text-[var(--ink-900)] transition" href="/">Home</Link></li>
              <li><Link className="hover:text-[var(--ink-900)] transition" href="/all-products">Shop</Link></li>
              <li><Link className="hover:text-[var(--ink-900)] transition" href="/about">About</Link></li>
              <li><Link className="hover:text-[var(--ink-900)] transition" href="/contact">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-[var(--ink-900)] mb-4">Support</h3>
            <div className="space-y-2 text-sm text-[var(--ink-500)]">
              <p>sagecart.support@gmail.com</p>
              <p>Mon - Sat, 9:00 AM to 7:00 PM</p>
              <p>Designed for your own storefront refresh</p>
            </div>
          </div>
        </div>

        <p className="pt-5 text-center text-xs md:text-sm text-[var(--ink-500)]">
          Copyright 2026 © SageCart. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
