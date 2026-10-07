"use client";

import { useSyncExternalStore } from "react";
import { parseGradeOverrides, type GradeIdentity, type PersonalGrade, gradeOverrideKey } from "@/lib/grade-overrides";

const EVENT = "uniza:personal-grades-change";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(EVENT, listener); };
}

export function useGradeOverrides(accountKey?: string) {
  const key = accountKey ? `uniza:personal-grades:v1:${accountKey}` : null;
  const raw = useSyncExternalStore(subscribe, () => {
    try { return key ? window.localStorage.getItem(key) || "{}" : "{}"; } catch { return "{}"; }
  }, () => "{}");
  const setGrade = (item: GradeIdentity, grade: PersonalGrade | null) => {
    if (!key) throw new Error("Account not loaded");
    // Read at write time so another tab's changes are not lost.
    const next = parseGradeOverrides(window.localStorage.getItem(key) || "{}");
    if (grade === null) delete next[gradeOverrideKey(item)];
    else next[gradeOverrideKey(item)] = grade;
    window.localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  };
  return { overrides: parseGradeOverrides(raw), setGrade };
}
