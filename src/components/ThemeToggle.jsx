"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Light is the default; the choice persists in localStorage and is applied
// pre-hydration by the inline script in the root layout (no flash).
export default function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(null); // null until mounted - avoids hydration mismatch

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("xportal-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`rounded-lg p-2 text-ink-muted hover:bg-bg-tertiary hover:text-ink ${className}`}
    >
      {dark === null ? <Moon size={16} className="opacity-0" /> : dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
