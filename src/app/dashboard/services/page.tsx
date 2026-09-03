"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AppIcon, type AppIconName } from "@/components/AppIcon";
import { useTranslation } from "@/hooks/useTranslation";
import { UNIZA_URLS } from "@/lib/uniza";
import { searchUnizaDirectory, type DirectoryPerson } from "@/lib/services";

export default function ServicesPage() {
  const { t, lang } = useTranslation();
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchCopy = lang === "sk"
    ? { placeholder: "Meno alebo priezvisko", button: "Hľadať", empty: "Žiadne výsledky" }
    : lang === "en"
      ? { placeholder: "First or last name", button: "Search", empty: "No results" }
      : lang === "uk"
        ? { placeholder: "Ім’я або прізвище", button: "Знайти", empty: "Нічого не знайдено" }
        : { placeholder: "Имя или фамилия", button: "Найти", empty: "Ничего не найдено" };
  const services: Array<{ name: string; description: string; href: string; icon: AppIconName }> = [
    { name: "AIVS / Vzdelávanie", description: t("nav_grades") as string, href: UNIZA_URLS.education, icon: "book" },
    { name: "Moodle", description: t("nav_subjects") as string, href: UNIZA_URLS.moodle, icon: "clipboard" },
    { name: "WebKredit", description: t("nav_food") as string, href: UNIZA_URLS.catering, icon: "restaurant" },
    { name: t("system_campus_map") as string, description: "campus.uniza.sk", href: UNIZA_URLS.campus, icon: "map-pin" },
    { name: t("services_directory") as string, description: "Kontakty UNIZA", href: UNIZA_URLS.directory, icon: "search" },
    { name: t("system_academic_calendar") as string, description: "Termíny akademického roka", href: UNIZA_URLS.academicCalendar, icon: "calendar" },
    { name: t("services_news") as string, description: "uniza.sk", href: UNIZA_URLS.news, icon: "info" },
    { name: t("services_mail") as string, description: "Webmail a sieťové služby", href: UNIZA_URLS.studentMail, icon: "mail" },
    { name: t("services_library") as string, description: "UK UNIZA", href: UNIZA_URLS.library, icon: "library" },
    { name: t("system_helpdesk") as string, description: "helpdesk.uniza.sk", href: UNIZA_URLS.helpdesk, icon: "shield" },
  ];

  return (
    <div>
      <div className="top-bar page-title-row"><div className="top-bar-title">{t("services_title")}</div><Link href="/dashboard" className="icon-button" aria-label={t("common_back") as string}><AppIcon name="x" size={20} /></Link></div>
      <div className="container services-page">
        <form className="directory-search" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const query = String(form.get("query") || "").trim(); if (query.length < 2) return; startTransition(async () => { setPeople(await searchUnizaDirectory(query)); setSearched(true); }); }}>
          <label htmlFor="directory-query">{t("services_directory")}</label>
          <div><AppIcon name="search" size={19} /><input id="directory-query" name="query" minLength={2} maxLength={80} placeholder={searchCopy.placeholder} autoComplete="off" /><button type="submit" disabled={pending}>{pending ? "…" : searchCopy.button}</button></div>
        </form>
        {searched ? <div className="directory-results">{people.length ? people.map((person) => <article key={`${person.name}-${person.email}`}><strong>{person.name}</strong><span>{person.job}</span><small>{[person.room, person.phone].filter(Boolean).join(" · ")}</small>{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : null}</article>) : <p>{searchCopy.empty}</p>}</div> : null}
        <div className="services-list">{services.map((service) => <a key={service.href} href={service.href} target="_blank" rel="noopener noreferrer" className="service-row"><span className="service-icon"><AppIcon name={service.icon} size={21} /></span><span><strong>{service.name}</strong><small>{service.description}</small></span><AppIcon name="external-link" size={17} /></a>)}</div>
        <a href="https://www.instagram.com/borrusik/" target="_blank" rel="noopener noreferrer" className="service-support"><AppIcon name="instagram" size={22} /><span><strong>{t("support_instagram")}</strong><small>{t("support_instagram_hint")}</small></span><AppIcon name="external-link" size={17} /></a>
      </div>
    </div>
  );
}
