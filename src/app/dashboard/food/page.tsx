"use client";

export type MenuItem = {
  id: string;
  mealName: string;
  price: string;
  allergens?: string;
};

import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { UNIZA_URLS } from "@/lib/uniza";

export default function StravaPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetcher = async () => {
    const { getStravaInfo, getStravaMenu, getStravaHistory } = await import("@/lib/strava");
    const infoData = await getStravaInfo();
    const [menuData, historyData] = await Promise.all([
      getStravaMenu(),
      getStravaHistory()
    ]);
    return { info: infoData, menu: menuData || [], history: historyData || [] };
  };

  const { data, isLoading, mutate } = useSWR("uniza_strava_all", fetcher);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  const loading = !mounted || (isLoading && !data);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  const info = data?.info || null;
  const menu = data?.menu || [];
  const history = data?.history || [];

  return (
    <div>
      <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="top-bar-title">{t("food_title")}</div>
          <div className="text-sm" style={{ marginTop: "2px" }}>{t("food_subtitle")}</div>
        </div>
        <button
          type="button"
          aria-label={t("common_refresh") as string}
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            background: "var(--surface-secondary)",
            border: "none",
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            opacity: isRefreshing ? 0.5 : 1
          }}
        >
          <svg className={isRefreshing ? "spin" : ""} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
            <path d="M3 22v-6h6"></path>
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
          </svg>
        </button>
      </div>

      <div className="container">
        {loading ? (
          <div>
            <div className="skeleton" style={{ height: "180px", borderRadius: "16px", marginBottom: "32px", width: "100%" }} />

            <div className="skeleton" style={{ height: "24px", width: "140px", marginBottom: "16px", borderRadius: "8px" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card skeleton" style={{ height: "76px" }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-slide-up">
            {/* ISIC Card / Balance */}
            <div style={{
              background: "linear-gradient(135deg, var(--primary), var(--orange))",
              borderRadius: "16px",
              padding: "24px",
              color: "white",
              boxShadow: "0 10px 20px rgba(0, 122, 255, 0.2)",
              marginBottom: "32px",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Card visual elements */}
              <div style={{ position: "absolute", right: "-20px", top: "-20px", width: "150px", height: "150px", background: "white", opacity: 0.1, borderRadius: "50%" }} />
              <div style={{ position: "absolute", left: "20px", bottom: "-40px", width: "100px", height: "100px", background: "white", opacity: 0.1, borderRadius: "50%" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, opacity: 0.85, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                    {t("food_isic_credit")}
                  </div>
                  <div style={{ fontSize: "36px", fontWeight: 800, textShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                    {info ? `${info.balance.toFixed(2).replace('.', ',')} €` : "—"}
                  </div>
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.2)",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backdropFilter: "blur(10px)"
                }}>
                  {info ? t("food_active") : t("food_unavailable")}
                </div>
              </div>

              <div style={{ marginTop: "24px", fontSize: "14px", fontWeight: 500, opacity: 0.9, position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{info?.name || "WebKredit"}</span>
              </div>
            </div>

            {/* Menu Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "0 4px" }}>
              <span className="label" style={{ fontSize: "17px", color: "var(--text-primary)" }}>{t("food_menu")}</span>
            </div>

            <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {menu.length === 0 && (
                <div className="card" style={{ textAlign: "center", padding: "24px" }}>
                  <p className="text-sm" style={{ marginBottom: "14px" }}>{t("food_menu_unavailable")}</p>
                  <a
                    href={UNIZA_URLS.catering}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge badge-neutral"
                    style={{ textDecoration: "none" }}
                  >
                    {t("food_open_official")}
                  </a>
                </div>
              )}
              {menu.map((item: { id?: string; mealName: string; price: string; allergens?: string }, index: number) => (
                <div key={item.id || index} className="card animate-scale-in" style={{ opacity: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "var(--surface-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "var(--primary)",
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="card-title" style={{ fontSize: "15px", marginBottom: "4px" }}>
                        {item.mealName}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span className="text-xs" style={{ color: "var(--success)" }}>
                          {item.price.replace(".", ",")}
                        </span>
                        {item.allergens && (
                          <>
                            <span className="text-xs">·</span>
                            <span className="text-xs">{t("food_allergens")} {item.allergens}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* History Section */}
            {history.length > 0 && (
              <div style={{ marginTop: "32px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "0 4px" }}>
                  <span className="label" style={{ fontSize: "17px", color: "var(--text-primary)" }}>{t("food_history")}</span>
                </div>

                <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {history.slice(0, 10).map((item: { movementTypeName: string; reserve: number; date: string; destination?: string; source?: string }, idx: number) => (
                    <div key={idx} className="card animate-scale-in" style={{ opacity: 0, padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.movementTypeName}
                        </div>
                        <div style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          color: item.reserve < 0 ? "var(--text-primary)" : "var(--success)"
                        }}>
                          {item.reserve > 0 ? "+" : ""}{(item.reserve || 0).toFixed(2).replace(".", ",")} €
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-tertiary)" }}>
                        <span>
                          {new Date(item.date).toLocaleDateString("sk", {
                            day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                        <span>{item.destination || item.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
