import { Geist, Geist_Mono } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

// One family, many weights: Geist carries the whole UI (headings are just
// heavier and tighter), Geist Mono carries data — numbers, dates, IDs.
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
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
