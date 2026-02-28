"use client";

import { useTransition, useState } from "react";
import { login } from "@/lib/scraper";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Clear old data and cookies before login to ensure fresh state
    try {
      localStorage.clear();
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
    } catch {
      // Ignore errors if any
    }

    startTransition(async () => {
      const result = await login(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/dashboard");
      }
    });
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      minHeight: "100dvh",
      padding: "32px 24px",
      background: "var(--background)",
    }}>
      {/* Logo + Title */}
      <div className="animate-slide-up" style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{
          width: "88px",
          height: "88px",
          background: "linear-gradient(145deg, var(--primary), var(--primary-hover))",
          borderRadius: "26px",
          margin: "0 auto 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "36px",
          fontWeight: 800,
          boxShadow: "0 12px 32px rgba(234, 179, 8, 0.35)",
          letterSpacing: "-1px",
        }}>
          UŽ
        </div>
        <h1 className="page-title" style={{ marginBottom: "6px" }}>{t("login_title")}</h1>
        <p className="text-sm" style={{ fontSize: "16px" }}>{t("login_subtitle")}</p>
      </div>

      {/* Login Form */}
      <form
        className="animate-fade-in"
        style={{ animationDelay: "0.15s", opacity: 0 }}
        onSubmit={handleLogin}
      >
        <div style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-xl)",
          padding: "28px 24px",
          boxShadow: "var(--shadow-md)",
          border: "0.5px solid var(--border)",
        }}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">{t("login_email")}</label>
            <input
              type="text"
              id="email"
              name="email"
              className="input-field"
              placeholder="meno@stud.uniza.sk"
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group" style={{ marginBottom: "28px" }}>
            <label className="input-label" htmlFor="password">{t("login_password")}</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input-field"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              color: "var(--danger)",
              fontSize: "14px",
              marginBottom: "16px",
              textAlign: "center",
              fontWeight: 500,
              padding: "10px",
              background: "var(--danger-light)",
              borderRadius: "var(--radius-sm)",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isPending}
          >
            {isPending ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "white", borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.6s linear infinite",
                }} />
                {t("login_loading")}
              </span>
            ) : t("login_button")}
          </button>
        </div>
      </form>

      <p style={{
        textAlign: "center",
        marginTop: "28px",
        color: "var(--text-tertiary)",
        fontSize: "12px",
        lineHeight: 1.5,
      }}>
        {t("login_terms")}
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
