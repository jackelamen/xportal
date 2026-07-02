import { Geist, Geist_Mono, Space_Grotesk, Instrument_Serif } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

// Type strategy:
//  - Instrument Serif — reserved for the one editorial moment per page: the
//    page-title hero (h1) and big KPI numbers. High-contrast and elegant; a
//    single restrained serif note against an otherwise-sans system.
//  - Geist — everything else: section headings, body, UI, labels, buttons.
//  - Geist Mono — data: dates, IDs, units, eyebrows.
//  - Space Grotesk — the xPortal wordmark only.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata = {
  title: "xPortal — Client Workspace",
  description: "Project status, deliverables, files, and billing in one place.",
  applicationName: "xPortal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "xPortal",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5b48ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} ${serif.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {/* Apply the saved theme before paint so dark mode never flashes light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("xportal-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
