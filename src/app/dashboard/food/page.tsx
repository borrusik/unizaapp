"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslation, type Lang } from "@/hooks/useTranslation";
import { UNIZA_URLS } from "@/lib/uniza";
import type { MenuItem } from "@/lib/uniza-parsers";
import { AppIcon } from "@/components/AppIcon";

const LOCALES: Record<Lang, string> = {
  sk: "sk-SK",
  en: "en-GB",
  uk: "uk-UA",
  ru: "ru-RU",
};

function formatMenuDate(dateKey: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export default function StravaPage() {
  const { t, lang } = useTranslation();
  const [canteenId, setCanteenId] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetcher = async (force = false) => {
    const { getStravaInfo, getStravaMenu, getStravaHistory } = await import("@/lib/strava");
    const [info, menu, history] = await Promise.all([
      getStravaInfo(force),
      getStravaMenu(canteenId, undefined, force),
      getStravaHistory(force),
    ]);
    return { info, menu, history: history || [] };
  };

  const { data, isLoading, mutate } = useSWR(
    ["uniza_strava_all", canteenId],
    () => fetcher(false),
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => fetcher(true), { revalidate: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const info = data?.info || null;
  const menu = data?.menu;
  const history = data?.history || [];
  const availableDates = menu?.requestedDates || [];
  const activeDate = selectedDate && availableDates.includes(selectedDate)
    ? selectedDate
    : availableDates[0] || "";
  const activeDay = menu?.days.find((day) => day.date === activeDate);
  const activeItems = activeDay?.groups.flatMap((group) => group.items) || [];

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
          className="icon-button"
        >
          <AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} />
        </button>
      </div>

      <div className="container">
        {isLoading && !data ? (
          <div>
            <div className="skeleton" style={{ height: "180px", borderRadius: "16px", marginBottom: "24px", width: "100%" }} />
            <div className="skeleton" style={{ height: "44px", marginBottom: "16px", borderRadius: "12px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1, 2, 3, 4].map((item) => <div key={item} className="card skeleton" style={{ height: "86px" }} />)}
            </div>
          </div>
        ) : (
          <div className="animate-slide-up">
            <div className="food-balance-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, opacity: 0.85, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>{t("food_isic_credit")}</div>
                  <div style={{ fontSize: "36px", fontWeight: 800 }}>{info ? `${info.balance.toFixed(2).replace(".", ",")} €` : "—"}</div>
                </div>
                <div className="food-balance-status">
                  {info ? t("food_active") : t("food_balance_reconnect")}
                </div>
              </div>
              <div style={{ marginTop: "24px", fontSize: "14px", fontWeight: 500, opacity: 0.9, position: "relative", zIndex: 1 }}>{info?.name || "WebKredit"}</div>
            </div>

            <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
              <label>
                <span className="label" style={{ display: "block", marginBottom: "7px" }}>{t("food_canteen")}</span>
                <select
                  value={menu?.selectedCanteenId || canteenId}
                  onChange={(event) => {
                    setCanteenId(Number(event.target.value));
                    setSelectedDate("");
                  }}
                  disabled={!menu || menu.canteens.length === 0}
                  style={{ width: "100%", minHeight: "44px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", padding: "0 12px", fontSize: "15px", fontWeight: 600 }}
                >
                  {(menu?.canteens || []).map((canteen) => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}
                </select>
              </label>
            </div>

            {menu?.message && (
              <div className="card" style={{ marginBottom: "16px", padding: "14px 16px", borderColor: "var(--warning)", background: "color-mix(in srgb, var(--warning) 10%, var(--surface))" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <AppIcon name="info" size={19} />
                  <span className="text-sm" style={{ color: "var(--text-primary)", lineHeight: 1.45 }}>{menu.message}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", padding: "0 4px" }}>
              <span className="label" style={{ fontSize: "17px", color: "var(--text-primary)" }}>{t("food_menu")}</span>
              <span className="badge badge-neutral" style={{ fontSize: "10px" }}>{t("food_public_source")}</span>
            </div>

            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "10px" }}>
              {availableDates.map((date) => (
                <button type="button" key={date} aria-pressed={activeDate === date} onClick={() => setSelectedDate(date)} className={`day-pill ${activeDate === date ? "active" : ""}`} style={{ minWidth: "96px", flex: "0 0 auto", padding: "10px 12px" }}>
                  {formatMenuDate(date, LOCALES[lang])}
                </button>
              ))}
            </div>

            {activeItems.length === 0 ? (
              <div className="empty-state">
                <AppIcon name={menu?.unavailable ? "warning" : "restaurant"} size={38} />
                <p className="text-sm" style={{ marginBottom: "14px" }}>{menu?.unavailable ? t("food_menu_unavailable") : t("food_no_menu_day")}</p>
                <a href={UNIZA_URLS.diningMenu} target="_blank" rel="noopener noreferrer" className="badge badge-neutral" style={{ textDecoration: "none" }}>{t("food_open_official")}</a>
              </div>
            ) : (
              <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeDay?.groups.map((group) => (
                  <section key={group.mealKindName} aria-label={group.mealKindName}>
                    {activeDay.groups.length > 1 && <div className="label" style={{ margin: "14px 4px 8px" }}>{group.mealKindName}</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {group.items.map((item: MenuItem) => (
                        <div key={item.id} className="card animate-scale-in" style={{ opacity: 0, padding: "16px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                            <div style={{ minWidth: "38px", height: "38px", borderRadius: "12px", background: "var(--surface-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--primary)" }}>{item.alternative ?? "•"}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="card-title" style={{ fontSize: "15px", lineHeight: 1.35, marginBottom: "5px" }}>{item.mealName}</div>
                              <div className="text-xs" style={{ display: "flex", gap: "7px", flexWrap: "wrap", alignItems: "center" }}>
                                {item.mealSize && <span>{item.mealSize}</span>}
                                {item.price && <span style={{ color: "var(--success)", fontWeight: 700 }}>{item.price}</span>}
                                {item.allergens && <span>{t("food_allergens")} {item.allergens}</span>}
                              </div>
                              {item.note && <div className="text-xs" style={{ marginTop: "5px" }}>{item.note}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {history.length > 0 && (
              <div style={{ marginTop: "32px", marginBottom: "20px" }}>
                <div className="label" style={{ fontSize: "17px", color: "var(--text-primary)", marginBottom: "16px", padding: "0 4px" }}>{t("food_history")}</div>
                <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {history.slice(0, 10).map((item, index) => (
                    <div key={`${item.date}-${index}`} className="card animate-scale-in" style={{ opacity: 0, padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "4px" }}>
                        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{item.movementTypeName}</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: item.reserve < 0 ? "var(--text-primary)" : "var(--success)", whiteSpace: "nowrap" }}>{item.reserve > 0 ? "+" : ""}{(item.reserve || 0).toFixed(2).replace(".", ",")} €</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "13px", color: "var(--text-tertiary)" }}>
                        <span>{new Date(item.date).toLocaleDateString(LOCALES[lang], { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
