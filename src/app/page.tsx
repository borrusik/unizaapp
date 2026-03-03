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
    <main style={{
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
        method="post"
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

      <div style={{
        marginTop: "32px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "0 16px"
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          color: "var(--success)",
          background: "var(--success-light)",
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          maxWidth: "400px",
          textAlign: "left",
          fontSize: "13px",
          lineHeight: 1.5,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>{t("login_safe_msg")}</span>
        </div>

        <a
          href="https://github.com/borrusik/unizaapp"
          target="_blank"
          rel="noopener noreferrer"
          className="hover-scale"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontWeight: 500,
            fontSize: "13px",
            padding: "8px 16px",
            borderRadius: "20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"></path>
          </svg>
          {t("login_open_source")}
        </a>

        <p style={{
          marginTop: "16px",
          color: "var(--text-tertiary)",
          fontSize: "12px",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          {t("login_terms")}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
