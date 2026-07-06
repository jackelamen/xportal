import { Geist, Geist_Mono, Syne } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

// Type strategy - two distinct voices, each with a job:
//  - Syne - the xPortal wordmark only. A characterful geometric display face
//    that gives the brand mark its own presence, distinct from body and hero.
//  - Geist - everything else: page-title hero (h1), section headings, body,
//    UI, labels, buttons, KPI numbers. One clean grotesk system, no serif
//    detour - reads as production SaaS rather than an editorial/deck font.
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
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`} suppressHydrationWarning>
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
