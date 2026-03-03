"use client";

import { useState, useEffect } from "react";

export type Lang = "sk" | "en" | "uk" | "ru";

export const dictionary = {
  sk: {
    nav_subjects: "Predmety",
    nav_schedule: "Rozvrh",
    nav_grades: "Známky",
    nav_food: "Jedáleň",
    nav_profile: "Profil",

    // Subjects
    subjects_title: "Moje predmety",
    subjects_winter: "Zimný semester",
    subjects_summer: "Letný semester",
    subjects_credits: "kreditov",
    subjects_completed: "Získané",
    subjects_to_complete: "Získať",
    subjects_no_data: "Žiadne predmety",

    // Schedule
    schedule_title: "Rozvrh",
    schedule_today: "Dnes",
    schedule_lecture: "Prednáška",
    schedule_exercise: "Cvičenie",
    schedule_lab: "Lab. cvičenie",
    schedule_min_left: "Zostáva",
    schedule_no_classes_title: "Žiadne hodiny",
    schedule_no_classes_desc: "Užívaj si voľný deň!",
    schedule_weekend_tab: "Víkend",
    schedule_weekend_title: "Konečne víkend!",
    schedule_weekend_desc: "Poriadne si oddýchni a naber sily do ďalšieho týždňa. Žiadne prednášky ťa nečakajú.",
    schedule_days_full: ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"],
    schedule_days_short: ["Po", "Ut", "St", "Št", "Pi", "So", "Ne", "Vík"],
    schedule_months: ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"],

    // Grades
    grades_title: "Známky",
    grades_avg: "Vážený priemer",
    grades_total_credits: "Získané kredity",
    grades_winter: "Zimný semester",
    grades_summer: "Letný semester",
    grades_no_grade: "Nehodnotené",

    // Food
    food_title: "Jedáleň",
    food_balance: "Aktuálny zostatok",
    food_order: "Objednať zostatok",
    food_menu: "Dnešné menu",
    food_allergens: "Alergény:",
    food_history: "História transakcií",
    food_no_history: "Žiadne nedávne transakcie",

    // Profile
    profile_title: "Profil",
    profile_avg: "Priemer",
    profile_completed: "Splnené",
    profile_info: "Informácie",
    profile_faculty: "Fakulta",
    profile_program: "Program",
    profile_id: "Osobné číslo",
    profile_group: "Študijná skupina",
    profile_year: "Ročník",
    profile_acad_year: "Akad. rok",
    profile_logout: "Odhlásiť sa",

    // Settings / Language
    settings_language: "Jazyk aplikácie",
    lang_sk: "Slovenčina",
    lang_en: "English",
    lang_uk: "Українська",
    lang_ru: "Русский",

    // Offline
    offline_msg: "Si offline. Zobrazujú sa uložené údaje.",

    // New keys
    login_title: "Vzdelávanie",
    login_subtitle: "Žilinská univerzita v Žiline",
    login_email: "Email",
    login_password: "Heslo",
    login_button: "Prihlásiť sa",
    login_loading: "Prihlasovanie...",
    login_terms: "Prihlásením súhlasíte s podmienkami UNIZA.",
    dashboard_acad_year: "Akad. rok 2025/2026",
    dashboard_subjects_count: "predmetov",
    dashboard_moodle: "MOODLE",
    dashboard_info_list: "Info list",
    grades_credits_short: "kr.",
    grades_points_short: "b.",
    food_subtitle: "Nová Menza / WebKredit",
    food_isic_credit: "ISIC Kredit",
    food_active: "Aktívne",
    subject_not_found_title: "Informácie nie sú dostupné",
    subject_not_found_desc: "Pre tento predmet sa nepodarilo načítať informačný list.",
    subject_type_default: "PREDMET",
    subject_credits: "Kreditov",
    subject_type: "Typ",
    subject_completion: "Ukončenie",
    subject_teaching: "Výučba",
    subject_workload: "Záťaž študenta",
    subject_conditions: "Podmienky absolvovania",
    subject_outcomes: "Výsledky vzdelávania",
    subject_syllabus: "Osnova predmetu",
    subject_literature: "Odporúčaná literatúra",
    subject_teacher: "Vyučujúci",
    subject_guarantor: "Garant predmetu",
  },
  en: {
    nav_subjects: "Subjects",
    nav_schedule: "Schedule",
    nav_grades: "Grades",
    nav_food: "Canteen",
    nav_profile: "Profile",

    subjects_title: "My Subjects",
    subjects_winter: "Winter Semester",
    subjects_summer: "Summer Semester",
    subjects_credits: "credits",
    subjects_completed: "Earned",
    subjects_to_complete: "To Earn",
    subjects_no_data: "No subjects found",

    schedule_title: "Schedule",
    schedule_today: "Today",
    schedule_lecture: "Lecture",
    schedule_exercise: "Exercise",
    schedule_lab: "Lab",
    schedule_min_left: "Left",
    schedule_no_classes_title: "No classes",
    schedule_no_classes_desc: "Enjoy your free day!",
    schedule_weekend_tab: "Weekend",
    schedule_weekend_title: "Finally weekend!",
    schedule_weekend_desc: "Get a proper rest and gather strength for the next week. No lectures waiting for you.",
    schedule_days_full: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    schedule_days_short: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su", "Wknd"],
    schedule_months: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],

    grades_title: "Grades",
    grades_avg: "Weighted Average",
    grades_total_credits: "Earned Credits",
    grades_winter: "Winter Semester",
    grades_summer: "Summer Semester",
    grades_no_grade: "Not graded",

    food_title: "Canteen",
    food_balance: "Current Balance",
    food_order: "Top up balance",
    food_menu: "Today's Menu",
    food_allergens: "Allergens:",
    food_history: "Transaction History",
    food_no_history: "No recent transactions",

    profile_title: "Profile",
    profile_avg: "Average",
    profile_completed: "Completed",
    profile_info: "Information",
    profile_faculty: "Faculty",
    profile_program: "Program",
    profile_id: "Personal ID",
    profile_group: "Study Group",
    profile_year: "Year",
    profile_acad_year: "Acad. year",
    profile_logout: "Log out",

    settings_language: "App Language",
    lang_sk: "Slovenčina",
    lang_en: "English",
    lang_uk: "Українська",
    lang_ru: "Русский",

    offline_msg: "You are offline. Showing cached data.",

    // New keys
    login_title: "Education",
    login_subtitle: "University of Žilina",
    login_email: "Email",
    login_password: "Password",
    login_button: "Log In",
    login_loading: "Logging in...",
    login_terms: "By logging in, you agree to UNIZA terms.",
    dashboard_acad_year: "Acad. year 2025/2026",
    dashboard_subjects_count: "subjects",
    dashboard_moodle: "MOODLE",
    dashboard_info_list: "Info list",
    grades_credits_short: "cr.",
    grades_points_short: "p.",
    food_subtitle: "Nová Menza / WebKredit",
    food_isic_credit: "ISIC Credit",
    food_active: "Active",
    subject_not_found_title: "Information unavailable",
    subject_not_found_desc: "Could not load the information sheet for this subject.",
    subject_type_default: "SUBJECT",
    subject_credits: "Credits",
    subject_type: "Type",
    subject_completion: "Completion",
    subject_teaching: "Teaching",
    subject_workload: "Student workload",
    subject_conditions: "Conditions for passing",
    subject_outcomes: "Learning outcomes",
    subject_syllabus: "Course syllabus",
    subject_literature: "Literature",
    subject_teacher: "Teacher",
    subject_guarantor: "Guarantor",
  },
  uk: {
    nav_subjects: "Дисципліни",
    nav_schedule: "Розклад",
    nav_grades: "Оцінки",
    nav_food: "Їдальня",
    nav_profile: "Профіль",

    subjects_title: "Мої предмети",
    subjects_winter: "Зимовий семестр",
    subjects_summer: "Літній семестр",
    subjects_credits: "кредитів",
    subjects_completed: "Здобуто",
    subjects_to_complete: "Залишилось",
    subjects_no_data: "Немає предметів",

    schedule_title: "Розклад",
    schedule_today: "Сьогодні",
    schedule_lecture: "Лекція",
    schedule_exercise: "Практика",
    schedule_lab: "Лабораторна",
    schedule_min_left: "Залишилось",
    schedule_no_classes_title: "Немає пар",
    schedule_no_classes_desc: "Насолоджуйся вільним днем!",
    schedule_weekend_tab: "Вихідні",
    schedule_weekend_title: "Нарешті вихідні!",
    schedule_weekend_desc: "Добре відпочинь та наберися сил на наступний тиждень. Лекцій не передбачається.",
    schedule_days_full: ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"],
    schedule_days_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд", "Вих"],
    schedule_months: ["січ", "лют", "бер", "кві", "трав", "чер", "лип", "сер", "вер", "жов", "лис", "гру"],

    grades_title: "Оцінки",
    grades_avg: "Середній бал",
    grades_total_credits: "Отримані кредити",
    grades_winter: "Зимовий семестр",
    grades_summer: "Літній семестр",
    grades_no_grade: "Не оцінено",

    food_title: "Їдальня",
    food_balance: "Поточний баланс",
    food_order: "Поповнити баланс",
    food_menu: "Меню на сьогодні",
    food_allergens: "Алергени:",
    food_history: "Історія транзакцій",
    food_no_history: "Немає недавніх транзакцій",

    profile_title: "Профіль",
    profile_avg: "Середній",
    profile_completed: "Пройдено",
    profile_info: "Інформація",
    profile_faculty: "Факультет",
    profile_program: "Програма",
    profile_id: "Особовий номер",
    profile_group: "Навчальна група",
    profile_year: "Курс",
    profile_acad_year: "Акад. рік",
    profile_logout: "Вийти",

    settings_language: "Мова додатку",
    lang_sk: "Slovenčina",
    lang_en: "English",
    lang_uk: "Українська",
    lang_ru: "Русский",

    offline_msg: "Ви офлайн. Показано збережені дані.",

    // New keys
    login_title: "Освіта",
    login_subtitle: "Жилінський університет",
    login_email: "Email",
    login_password: "Пароль",
    login_button: "Увійти",
    login_loading: "Вхід...",
    login_terms: "Увійшовши, ви погоджуєтеся з умовами UNIZA.",
    dashboard_acad_year: "Акад. рік 2025/2026",
    dashboard_subjects_count: "предметів",
    dashboard_moodle: "MOODLE",
    dashboard_info_list: "Інфолист",
    grades_credits_short: "кр.",
    grades_points_short: "б.",
    food_subtitle: "Nová Menza / WebKredit",
    food_isic_credit: "Кредит ISIC",
    food_active: "Активно",
    subject_not_found_title: "Інформація недоступна",
    subject_not_found_desc: "Не вдалося завантажити інфолист для цього предмету.",
    subject_type_default: "ПРЕДМЕТ",
    subject_credits: "Кредитів",
    subject_type: "Тип",
    subject_completion: "Завершення",
    subject_teaching: "Викладання",
    subject_workload: "Навантаження",
    subject_conditions: "Умови проходження",
    subject_outcomes: "Результати навчання",
    subject_syllabus: "Програма курсу",
    subject_literature: "Література",
    subject_teacher: "Викладач",
    subject_guarantor: "Гарант предмету",
  },
  ru: {
    nav_subjects: "Предметы",
    nav_schedule: "Расписание",
    nav_grades: "Оценки",
    nav_food: "Столовая",
    nav_profile: "Профиль",

    subjects_title: "Мои предметы",
    subjects_winter: "Зимний семестр",
    subjects_summer: "Летний семестр",
    subjects_credits: "кредитов",
    subjects_completed: "Получено",
    subjects_to_complete: "Осталось",
    subjects_no_data: "Нет предметов",

    schedule_title: "Расписание",
    schedule_today: "Сегодня",
    schedule_lecture: "Лекция",
    schedule_exercise: "Практика",
    schedule_lab: "Лабораторная",
    schedule_min_left: "Осталось",
    schedule_no_classes_title: "Нет пар",
    schedule_no_classes_desc: "Наслаждайся свободным днем!",
    schedule_weekend_tab: "Выходные",
    schedule_weekend_title: "Наконец-то выходные!",
    schedule_weekend_desc: "Хорошо отдохни и наберись сил на следующую неделю. Лекций не предвидится.",
    schedule_days_full: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
    schedule_days_short: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс", "Вых"],
    schedule_months: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],

    grades_title: "Оценки",
    grades_avg: "Средний балл",
    grades_total_credits: "Полученные кредиты",
    grades_winter: "Зимний семестр",
    grades_summer: "Летний семестр",
    grades_no_grade: "Не оценено",

    food_title: "Столовая",
    food_balance: "Текущий баланс",
    food_order: "Пополнить баланс",
    food_menu: "Меню на сегодня",
    food_allergens: "Аллергены:",
    food_history: "История транзакций",
    food_no_history: "Нет недавних транзакций",

    profile_title: "Профиль",
    profile_avg: "Средний",
    profile_completed: "Пройдено",
    profile_info: "Информация",
    profile_faculty: "Факультет",
    profile_program: "Программа",
    profile_id: "Личный номер",
    profile_group: "Учебная группа",
    profile_year: "Курс",
    profile_acad_year: "Акад. год",
    profile_logout: "Выйти",

    settings_language: "Язык приложения",
    lang_sk: "Slovenčina",
    lang_en: "English",
    lang_uk: "Українська",
    lang_ru: "Русский",

    offline_msg: "Вы не в сети. Показаны сохраненные данные.",

    login_title: "Образование",
    login_subtitle: "Жилинский университет",
    login_email: "Email",
    login_password: "Пароль",
    login_button: "Войти",
    login_loading: "Вход...",
    login_terms: "Входя, вы соглашаетесь с условиями UNIZA.",
    dashboard_acad_year: "Акад. год 2025/2026",
    dashboard_subjects_count: "предметов",
    dashboard_moodle: "MOODLE",
    dashboard_info_list: "Инфолист",
    grades_credits_short: "кр.",
    grades_points_short: "б.",
    food_subtitle: "Nová Menza / WebKredit",
    food_isic_credit: "Кредит ISIC",
    food_active: "Активно",
    subject_not_found_title: "Информация недоступна",
    subject_not_found_desc: "Не удалось загрузить инфолист для этого предмета.",
    subject_type_default: "ПРЕДМЕТ",
    subject_credits: "Кредитов",
    subject_type: "Тип",
    subject_completion: "Завершение",
    subject_teaching: "Обучение",
    subject_workload: "Нагрузка",
    subject_conditions: "Условия прохождения",
    subject_outcomes: "Результаты обучения",
    subject_syllabus: "Программа курса",
    subject_literature: "Литература",
    subject_teacher: "Преподаватель",
    subject_guarantor: "Гарант предмета",
  }
};

export function useTranslation() {
  const [lang, setLang] = useState<Lang>("sk"); // Default to sk

  useEffect(() => {
    // Run on client side only
    const savedLang = localStorage.getItem("uniza_lang") as Lang | null;

    if (savedLang && ["sk", "en", "uk", "ru"].includes(savedLang)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLang(savedLang);
    } else {
      const navAny = navigator as unknown as { userLanguage?: string };
      const userLang = navigator.language || navAny.userLanguage || "sk";
      if (userLang.startsWith("uk")) {
        setLang("uk"); // Map Ukrainian region to uk
      } else if (userLang.startsWith("ru")) {
        setLang("ru"); // Map Russian region to ru
      } else if (userLang.startsWith("en")) {
        setLang("en");
      } else {
        setLang("sk");
      }
    }

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Lang>;
      if (customEvent.detail) setLang(customEvent.detail);
    };

    window.addEventListener("unizaLanguageChange", handleLanguageChange);
    return () => window.removeEventListener("unizaLanguageChange", handleLanguageChange);
  }, []);

  const changeLanguage = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("uniza_lang", newLang);
    window.dispatchEvent(new CustomEvent("unizaLanguageChange", { detail: newLang }));
  };

  return {
    t: (key: keyof typeof dictionary.sk) => dictionary[lang]?.[key] || dictionary.sk[key],
    lang,
    setLang: changeLanguage
  };
}
