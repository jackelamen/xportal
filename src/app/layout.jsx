import { Geist, Geist_Mono, Syne, Instrument_Serif } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

// Type strategy - three distinct voices, each with a job:
//  - Instrument Serif - the one editorial moment per page: the page-title hero
//    (h1) and big KPI numbers. A single restrained serif note.
//  - Syne - the xPortal wordmark only. A characterful geometric display face
//    that gives the brand mark its own presence, distinct from body and hero.
//  - Geist - everything else: section headings, body, UI, labels, buttons.
//  - Geist Mono - data: dates, IDs, units, eyebrows.
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
const display = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
  title: "xPortal · Client Workspace",
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
