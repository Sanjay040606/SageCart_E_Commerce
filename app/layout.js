import "./globals.css";
import "leaflet/dist/leaflet.css";
import AppProviders from "@/components/app-providers";

export const metadata = {
  title: "SageCart",
  description: "A calm, modern storefront for curated everyday shopping.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased app-shell text-[var(--ink-700)]">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
