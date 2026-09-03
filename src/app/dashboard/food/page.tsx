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
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetcher = async (force = false) => {
    const { getStravaInfo, getStravaMenu } = await import("@/lib/strava");
    const [info, menu] = await Promise.all([
      getStravaInfo(force),
      getStravaMenu(canteenId, undefined, force),
    ]);
    return { info, menu };
  };

  const { data, isLoading, mutate } = useSWR(
    ["uniza_strava_all", canteenId],
    () => fetcher(false),
  );
  const { data: historyData, isLoading: historyLoading, mutate: mutateHistory } = useSWR(
    historyOpen ? "uniza_strava_history" : null,
    async () => {
      const { getStravaHistory } = await import("@/lib/strava");
      return getStravaHistory(false);
    },
  );

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await mutate(() => fetcher(true), { revalidate: false });
      if (historyOpen) {
        const { getStravaHistory } = await import("@/lib/strava");
        await mutateHistory(() => getStravaHistory(true), { revalidate: false });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const info = data?.info || null;
  const menu = data?.menu;
  const history = historyData || [];
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
            <div className="food-toolbar">
              <label className="food-canteen-select">
                <span>{t("food_canteen")}</span>
                <select
                  value={menu?.selectedCanteenId || canteenId}
                  onChange={(event) => {
                    setCanteenId(Number(event.target.value));
                    setSelectedDate("");
                  }}
                  disabled={!menu || menu.canteens.length === 0}
                >
                  {(menu?.canteens || []).map((canteen) => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}
                </select>
              </label>
              <div className="food-credit" title={info?.name || "WebKredit"}>
                <span className="food-credit-label">{t("food_isic_credit")}</span>
                <strong>{info ? `${info.balance.toFixed(2).replace(".", ",")} €` : "—"}</strong>
              </div>
            </div>

            <div className="food-section-heading">
              <h2>{t("food_menu")}</h2>
              <span className="food-source">{t("food_public_source")}</span>
            </div>

            <div className="food-date-tabs">
              {availableDates.map((date) => (
                <button type="button" key={date} aria-pressed={activeDate === date} onClick={() => setSelectedDate(date)} className={`food-date-tab ${activeDate === date ? "active" : ""}`}>
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
              <div className="stagger">
                {activeDay?.groups.map((group) => (
                  <section key={group.mealKindName} aria-label={group.mealKindName}>
                    {activeDay.groups.length > 1 && <div className="food-group-label">{group.mealKindName}</div>}
                    <div className="food-menu-list">
                      {group.items.map((item: MenuItem) => (
                        <div key={item.id} className="food-menu-row animate-fade-in" style={{ opacity: 0 }}>
                          <div className="food-menu-number">{item.alternative ?? "–"}</div>
                          <div className="food-menu-copy">
                            <div className="food-menu-name">{item.mealName}</div>
                            <div className="food-menu-meta">
                              {item.mealSize && <span>{item.mealSize}</span>}
                              {item.allergens && <span>{t("food_allergens")} {item.allergens}</span>}
                              {item.note && <span>{item.note}</span>}
                            </div>
                          </div>
                          {item.price && <div className="food-menu-price">{item.price}</div>}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <details
              className="food-history-details"
              onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            >
              <summary>
                <span>{t("food_history")}</span>
                <AppIcon name="chevron-down" size={19} />
              </summary>
              {historyLoading ? (
                <div className="food-history-loading skeleton" />
              ) : history.length === 0 ? (
                <p className="text-sm food-history-empty">{t("food_no_history")}</p>
              ) : (
                <div className="food-history-list stagger">
                  {history.slice(0, 10).map((item, index) => (
                    <div key={`${item.date}-${index}`} className="food-history-row animate-fade-in" style={{ opacity: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="food-menu-name">{item.movementTypeName}</div>
                        <div className="food-menu-meta">
                          <span>{new Date(item.date).toLocaleDateString(LOCALES[lang], { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{item.destination || item.source}</span>
                        </div>
                      </div>
                      <div className="food-menu-price" style={{ color: item.reserve < 0 ? "var(--text-primary)" : "var(--success)" }}>{item.reserve > 0 ? "+" : ""}{(item.reserve || 0).toFixed(2).replace(".", ",")} €</div>
                    </div>
                  ))}
                </div>
              )}
            </details>
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
