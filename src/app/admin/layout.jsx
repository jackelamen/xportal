// Pass-through layout: gives every /admin route the operator identity:
// emerald favicon (icon.svg / apple-icon.png in this folder) and its own
// installable manifest, so the admin PWA is distinct from the client one.
export const metadata = {
  title: "xPortal · Operator Console",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "xPortal Admin" },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

export default function AdminRootLayout({ children }) {
  return children;
}
