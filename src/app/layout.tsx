import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const standalone = process.env.NEXT_PUBLIC_TARGET === "standalone";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// The icons are Next's src/app/icon.png and apple-icon.png. The phone-only app also links its manifest (written by
// scripts/build-pages.mjs) and names itself for the Home Screen. Metadata paths don't get the base path added.
export const metadata: Metadata = {
  title: "RC Lap Timer",
  description: "The open source RC lap timer",
  ...(standalone && {
    manifest: `${basePath}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Lap Timer", statusBarStyle: "default" },
  }),
};

// "cover" lets the installed app use the whole screen; the bottom bar pads itself clear of the home indicator.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  ...(standalone && { viewportFit: "cover" }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
