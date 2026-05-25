import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jakarta",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Pathways",
  description: "Find your immigration pathway",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakarta.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
