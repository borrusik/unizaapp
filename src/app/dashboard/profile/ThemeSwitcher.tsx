"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const { t } = useTranslation();

  // On mount, sync the state with localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("uniza_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme("system");
    }
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    const root = document.documentElement;

    if (newTheme === "system") {
      localStorage.removeItem("uniza_theme");
      root.removeAttribute("data-theme");
    } else {
      localStorage.setItem("uniza_theme", newTheme);
      root.setAttribute("data-theme", newTheme);
    }
  };

  return (
    <div className="card-row" style={{ marginTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span className="text-sm" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
        Theme
      </span>
      <div style={{ display: "flex", gap: "8px", background: "var(--surface-secondary)", padding: "4px", borderRadius: "12px" }}>
        <button
          onClick={() => handleThemeChange("light")}
          style={{
            background: theme === "light" ? "var(--surface)" : "transparent",
            color: theme === "light" ? "var(--text-primary)" : "var(--text-tertiary)",
            border: "none",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: theme === "light" ? "var(--shadow-sm)" : "none",
            transition: "all 0.2s"
          }}
        >
          Light
        </button>
        <button
          onClick={() => handleThemeChange("system")}
          style={{
            background: theme === "system" ? "var(--surface)" : "transparent",
            color: theme === "system" ? "var(--text-primary)" : "var(--text-tertiary)",
            border: "none",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: theme === "system" ? "var(--shadow-sm)" : "none",
            transition: "all 0.2s"
          }}
        >
          Auto
        </button>
        <button
          onClick={() => handleThemeChange("dark")}
          style={{
            background: theme === "dark" ? "var(--surface)" : "transparent",
            color: theme === "dark" ? "var(--text-primary)" : "var(--text-tertiary)",
            border: "none",
            borderRadius: "8px",
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: theme === "dark" ? "var(--shadow-sm)" : "none",
            transition: "all 0.2s"
          }}
        >
          Dark
        </button>
      </div>
    </div>
  );
}
