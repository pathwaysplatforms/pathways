import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { DevToolbarLoader } from "@/components/dev/DevToolbarLoader";
import "./globals.css";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-urbanist",
});


export const metadata: Metadata = {
  title: "Pathways",
  description: "Find your immigration pathway",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={urbanist.variable}
    >
      <body className="font-sans" suppressHydrationWarning>
        {children}
        {/* Grain / film-noise overlay — barely perceptible paper texture */}
        <svg
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 9999,
            opacity: 0.035,
          }}
        >
          <filter id="pw-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pw-grain)" />
        </svg>
        {process.env.NODE_ENV === "development" && <DevToolbarLoader />}
      </body>
    </html>
  );
}
