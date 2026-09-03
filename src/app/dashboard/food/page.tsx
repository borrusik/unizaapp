"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useTranslation, type Lang } from "@/hooks/useTranslation";
import { UNIZA_URLS } from "@/lib/uniza";
import type { IntegrationOperationResult, MenuItem, WebKreditOrder } from "@/lib/uniza-parsers";
import { AppIcon } from "@/components/AppIcon";

const LOCALES: Record<Lang, string> = { sk: "sk-SK", en: "en-GB", uk: "uk-UA", ru: "ru-RU" };
const CANTEEN_STORAGE_KEY = "uniza:canteen:v1";

function formatMenuDate(dateKey: string, locale: string, long = false) {
  return new Intl.DateTimeFormat(locale, { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short" }).format(new Date(`${dateKey}T12:00:00Z`));
}

function stateLabel(item: MenuItem, t: ReturnType<typeof useTranslation>["t"]) {
  if (item.canOrder) return t("food_order_available") as string;
  if (item.state === 5 || item.state === 43) return t("food_ordering_closed") as string;
  return t("food_order_unavailable") as string;
}

export default function StravaPage() {
  const { t, lang } = useTranslation();
  const [canteenId, setCanteenId] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MenuItem | null>(null);
  const [cancelOrder, setCancelOrder] = useState<WebKreditOrder | null>(null);
  const [editOrder, setEditOrder] = useState<WebKreditOrder | null>(null);
  const [editAlternative, setEditAlternative] = useState(0);
  const [editCanteenId, setEditCanteenId] = useState(0);
  const [componentAmounts, setComponentAmounts] = useState<Record<number, number>>({});
  const [operation, setOperation] = useState<IntegrationOperationResult | null>(null);
  const [isOperating, startOperation] = useTransition();

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(CANTEEN_STORAGE_KEY));
    if (Number.isInteger(stored) && stored > 0 && stored < 1_000) setCanteenId(stored);
  }, []);

  const fetcher = async (force = false) => {
    const { getStravaInfo, getStravaMenu, getStravaOrders } = await import("@/lib/strava");
    const [info, menu, orders] = await Promise.all([getStravaInfo(force), getStravaMenu(canteenId, undefined, force), getStravaOrders(undefined, undefined, force)]);
    return { info, menu, orders };
  };

  const { data, isLoading, mutate } = useSWR(["uniza_strava_all", canteenId], () => fetcher(false));
  const { data: historyData, isLoading: historyLoading, mutate: mutateHistory } = useSWR(
    historyOpen ? "uniza_strava_history" : null,
    async () => (await import("@/lib/strava")).getStravaHistory(false),
  );

  const refreshAll = async () => {
    await mutate(() => fetcher(true), { revalidate: false });
    if (historyOpen) {
      const { getStravaHistory } = await import("@/lib/strava");
      await mutateHistory(() => getStravaHistory(true), { revalidate: false });
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try { await refreshAll(); } finally { setIsRefreshing(false); }
  };

  const info = data?.info || null;
  const menu = data?.menu;
  const orders = data?.orders || [];
  const history = historyData || [];
  const availableDates = menu?.requestedDates || [];
  const activeDate = selectedDate && availableDates.includes(selectedDate) ? selectedDate : availableDates[0] || "";
  const activeDay = menu?.days.find((day) => day.date === activeDate);
  const activeItems = activeDay?.groups.flatMap((group) => group.items) || [];
  const totalComponentWeight = useMemo(() => Object.values(componentAmounts).reduce((sum, amount) => sum + amount, 0), [componentAmounts]);
  const componentsValid = !selectedMeal?.composites.length || (totalComponentWeight > 0 && (selectedMeal.compositeMaxWeight === null || totalComponentWeight <= selectedMeal.compositeMaxWeight));

  const closeDialog = () => { setSelectedMeal(null); setCancelOrder(null); setEditOrder(null); setComponentAmounts({}); };

  const openEditDialog = (order: WebKreditOrder) => {
    setEditOrder(order);
    setEditAlternative(order.alternative ?? order.alternatives[0]?.id ?? 0);
    setEditCanteenId(order.canteenId || order.canteens[0]?.id || 0);
  };

  const submitOrder = () => {
    if (!selectedMeal || !componentsValid || isOperating) return;
    startOperation(async () => {
      const { placeStravaOrder } = await import("@/lib/strava");
      const result = await placeStravaOrder({
        date: selectedMeal.date,
        mealKindId: selectedMeal.mealKindId,
        alternative: selectedMeal.alternative ?? 0,
        canteenId: selectedMeal.canteenId,
        composites: selectedMeal.composites.map((entry) => ({ id: entry.id, amount: componentAmounts[entry.id] || 0 })),
      });
      setOperation(result);
      closeDialog();
      await refreshAll();
    });
  };

  const submitCancel = () => {
    if (!cancelOrder || isOperating) return;
    startOperation(async () => {
      const { cancelStravaOrder } = await import("@/lib/strava");
      const result = await cancelStravaOrder(cancelOrder.id);
      setOperation(result);
      closeDialog();
      await refreshAll();
    });
  };

  const submitChange = () => {
    if (!editOrder || isOperating) return;
    startOperation(async () => {
      const { changeStravaOrder } = await import("@/lib/strava");
      const result = await changeStravaOrder({ id: editOrder.id, alternative: editAlternative, canteenId: editCanteenId });
      setOperation(result);
      closeDialog();
      await refreshAll();
    });
  };

  const dialogDate = cancelOrder?.date || editOrder?.date || selectedMeal?.date || "";
  const dialogPrice = cancelOrder?.price || editOrder?.price || selectedMeal?.price || "";
  const dateLabel = lang === "sk" ? "Dátum" : lang === "en" ? "Date" : "Дата";
  const priceLabel = lang === "sk" ? "Cena" : lang === "en" ? "Price" : lang === "uk" ? "Ціна" : "Цена";

  return (
    <div>
      <div className="top-bar food-top-bar">
        <div><div className="top-bar-title">{t("food_title")}</div><div className="text-sm">{t("food_subtitle")}</div></div>
        <button type="button" aria-label={t("common_refresh") as string} onClick={handleRefresh} disabled={isRefreshing} className="icon-button"><AppIcon name="refresh" size={20} className={isRefreshing ? "spin" : ""} /></button>
      </div>

      <div className="container">
        {isLoading && !data ? (
          <div className="food-loading"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
        ) : (
          <div className="animate-slide-up">
            <section className="food-summary" aria-label={t("food_balance") as string}>
              <div><span>{t("food_isic_credit")}</span><strong>{info ? `${info.balance.toFixed(2).replace(".", ",")} €` : "—"}</strong></div>
              <label className="food-canteen-select"><span>{t("food_canteen")}</span><select value={menu?.selectedCanteenId || canteenId} onChange={(event) => { const value = Number(event.target.value); setCanteenId(value); setSelectedDate(""); window.localStorage.setItem(CANTEEN_STORAGE_KEY, String(value)); }} disabled={!menu?.canteens.length}>{(menu?.canteens || []).map((canteen) => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}</select></label>
            </section>

            {operation ? <div className={`operation-message ${operation.status}`} role="status"><AppIcon name={operation.status === "success" ? "check" : operation.status === "uncertain" ? "warning" : "info"} size={19} /><span>{operation.message}</span><button type="button" onClick={() => setOperation(null)} aria-label={t("food_close") as string}><AppIcon name="x" size={17} /></button></div> : null}

            {orders.length > 0 ? (
              <section className="food-orders-section">
                <div className="food-section-heading"><h2>{t("food_orders")}</h2><span>{orders.length}</span></div>
                <div className="food-order-list">{orders.map((order) => (
                  <article key={order.id} className="food-order-row"><div className="food-order-date"><strong>{new Date(`${order.date}T12:00:00Z`).getUTCDate()}</strong><span>{formatMenuDate(order.date, LOCALES[lang]).split(" ").at(-1)}</span></div><div className="food-menu-copy"><div className="food-menu-name">{order.name}</div><div className="food-menu-meta"><span>{order.canteen}</span>{order.price ? <span>{order.price}</span> : null}</div></div><div className="food-order-actions">{((order.canChangeAlternative && order.alternatives.length > 0) || (order.canChangeCanteen && order.canteens.length > 0)) ? <button type="button" className="text-action" onClick={() => openEditDialog(order)}>{t("food_change_action")}</button> : null}{order.canCancel ? <button type="button" className="text-action danger" onClick={() => setCancelOrder(order)}>{t("food_cancel_action")}</button> : null}</div></article>
                ))}</div>
              </section>
            ) : null}

            <div className="food-section-heading"><h2>{t("food_menu")}</h2><span className="food-source">WebKredit</span></div>
            <div className="food-date-tabs">{availableDates.map((date) => <button type="button" key={date} aria-pressed={activeDate === date} onClick={() => setSelectedDate(date)} className={`food-date-tab ${activeDate === date ? "active" : ""}`}>{formatMenuDate(date, LOCALES[lang])}</button>)}</div>

            {activeItems.length === 0 ? (
              <div className="empty-state"><AppIcon name={menu?.unavailable ? "warning" : "restaurant"} size={38} /><p className="text-sm">{menu?.unavailable ? t("food_menu_unavailable") : t("food_no_menu_day")}</p><a href={UNIZA_URLS.diningMenu} target="_blank" rel="noopener noreferrer" className="text-action">{t("food_open_official")}<AppIcon name="external-link" size={15} /></a></div>
            ) : (
              <div className="food-menu-sections">{activeDay?.groups.map((group) => (
                <section key={group.mealKindName} aria-label={group.mealKindName}>{activeDay.groups.length > 1 ? <div className="food-group-label">{group.mealKindName}</div> : null}<div className="food-menu-list">{group.items.map((item) => (
                  <article key={item.id} className="food-menu-row"><div className="food-menu-number">{item.alternative ?? "–"}</div><div className="food-menu-copy"><div className="food-menu-name">{item.mealName}</div><div className="food-menu-meta">{item.mealSize ? <span>{item.mealSize}</span> : null}{item.allergens ? <span>{t("food_allergens")} {item.allergens}</span> : null}{item.note ? <span>{item.note}</span> : null}{item.nutritionalValues ? <span>{t("food_nutrition")}: {item.nutritionalValues}</span> : null}</div><span className={`food-state ${item.canOrder && menu?.canOrder ? "available" : ""}`}>{stateLabel(item, t)}</span></div><div className="food-menu-actions">{item.price ? <div className="food-menu-price">{item.price}</div> : null}{item.canOrder && menu?.canOrder ? <button type="button" className="btn-compact" onClick={() => setSelectedMeal(item)}>{t("food_order_action")}</button> : null}</div></article>
                ))}</div></section>
              ))}</div>
            )}

            <details className="food-history-details" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}><summary><span>{t("food_history")}</span><AppIcon name="chevron-down" size={19} /></summary>{historyLoading ? <div className="food-history-loading skeleton" /> : history.length === 0 ? <p className="text-sm food-history-empty">{t("food_no_history")}</p> : <div className="food-history-list">{history.slice(0, 10).map((item, index) => <div key={`${item.date}-${index}`} className="food-history-row"><div className="food-menu-copy"><div className="food-menu-name">{item.movementTypeName}</div><div className="food-menu-meta"><span>{new Date(item.date).toLocaleDateString(LOCALES[lang], { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span><span>{item.destination || item.source}</span></div></div><div className="food-menu-price">{item.reserve > 0 ? "+" : ""}{(item.reserve || 0).toFixed(2).replace(".", ",")} €</div></div>)}</div>}</details>
          </div>
        )}
      </div>

      {selectedMeal || cancelOrder || editOrder ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isOperating) closeDialog(); }}>
          <section className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="food-dialog-title"><div className="dialog-icon"><AppIcon name={cancelOrder ? "warning" : "restaurant"} size={24} /></div><h2 id="food-dialog-title">{cancelOrder ? t("food_confirm_cancel") : editOrder ? t("food_confirm_change") : t("food_confirm_order")}</h2><p>{cancelOrder?.name || editOrder?.name || selectedMeal?.mealName}</p><dl><div><dt>{t("food_canteen")}</dt><dd>{cancelOrder?.canteen || editOrder?.canteen || menu?.canteens.find((canteen) => canteen.id === selectedMeal?.canteenId)?.name || "—"}</dd></div><div><dt>{dateLabel}</dt><dd>{formatMenuDate(dialogDate, LOCALES[lang], true)}</dd></div>{dialogPrice ? <div><dt>{priceLabel}</dt><dd>{dialogPrice}</dd></div> : null}</dl>
            {editOrder ? <div className="order-edit-fields">{editOrder.canChangeAlternative && editOrder.alternatives.length > 0 ? <label><span>{t("food_menu")}</span><select value={editAlternative} onChange={(event) => setEditAlternative(Number(event.target.value))}>{editOrder.alternatives.map((alternative) => <option key={alternative.id} value={alternative.id}>{alternative.name}</option>)}</select></label> : null}{editOrder.canChangeCanteen && editOrder.canteens.length > 0 ? <label><span>{t("food_canteen")}</span><select value={editCanteenId} onChange={(event) => setEditCanteenId(Number(event.target.value))}>{editOrder.canteens.map((canteen) => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}</select></label> : null}</div> : null}
            {selectedMeal?.composites.length ? <div className="composite-fields"><strong>{t("food_components")}</strong>{selectedMeal.composites.map((entry) => <label key={entry.id}><span>{entry.name}</span><input type="number" inputMode="numeric" min="0" max={selectedMeal.compositeMaxWeight || 5000} value={componentAmounts[entry.id] || 0} onChange={(event) => setComponentAmounts((current) => ({ ...current, [entry.id]: Math.max(0, Number(event.target.value) || 0) }))} /><span>g</span></label>)}<div className={`composite-total ${componentsValid ? "" : "invalid"}`}>{t("food_total_weight")}: {totalComponentWeight}{selectedMeal.compositeMaxWeight ? ` / ${selectedMeal.compositeMaxWeight}` : ""} g</div></div> : null}
            <div className="dialog-actions"><button type="button" className="btn-secondary" onClick={closeDialog} disabled={isOperating}>{t("food_close")}</button><button type="button" className={cancelOrder ? "btn-danger" : "btn-primary"} onClick={cancelOrder ? submitCancel : editOrder ? submitChange : submitOrder} disabled={isOperating || (!cancelOrder && !editOrder && !componentsValid)}>{isOperating ? "…" : cancelOrder ? t("food_cancel_action") : editOrder ? t("food_confirm_change") : t("food_confirm_order")}</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
