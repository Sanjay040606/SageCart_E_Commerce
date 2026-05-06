import { Outfit } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/app-providers";

const outfit = Outfit({ subsets: ['latin'], weight: ["300", "400", "500"] })

export const metadata = {
  title: "SageCart",
  description: "A calm, modern storefront for curated everyday shopping.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} antialiased app-shell text-[var(--ink-700)]`} >
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
