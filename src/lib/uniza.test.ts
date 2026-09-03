import assert from "node:assert/strict";
import test from "node:test";

import {
  getAcademicYear,
  resolveExamTermsUrl,
  resolveMoodleUrl,
  resolveSubjectInfoUrl,
} from "./uniza.ts";
import { getBratislavaDayIndex, getScheduleTiming } from "./schedule-timing.ts";
import {
  getAcademicYearStartFromSlovakDate,
  getBratislavaDateKey,
  listDateKeys,
  localDateToUtcIso,
  parseAcademicYears,
  parseWebKreditCanteens,
  parseWebKreditMenu,
  parseWebKreditOperation,
  parseWebKreditOrders,
} from "./uniza-parsers.ts";
import { parseAivsSubjects } from "./aivs-subjects.ts";
import { parseAivsExamTerms } from "./aivs-exams.ts";
import { createIcsCalendar } from "./calendar.ts";

test("AIVS subjects are deduplicated per semester and useful links are merged", () => {
  const parsed = parseAivsSubjects(`
    <table id="id-tabulka-predmety-s"><tr><td><table>
      <tr><td class="sep">Zimný semester</td></tr>
      <tr><td><a href="planinfo.php?id=1">6BI0001 Informatika</a></td><td></td></tr>
      <tr><td class="sep">Letný semester</td></tr>
      <tr><td><a href="planinfo.php?id=2">6BL0001 ekonomické a právne aspekty podnikania</a></td><td></td></tr>
      <tr><td>6BL0001 ekonomické a právne aspekty podnikania</td><td><a target="tmoodle" href="https://vzdelavanie.uniza.sk/moodle/course/view.php?id=2">Moodle</a></td></tr>
    </table></td></tr></table>
  `);

  assert.equal(parsed.winter.length, 1);
  assert.equal(parsed.summer.length, 1);
  assert.equal(parsed.summer[0].code, "6BL0001");
  assert.equal(parsed.summer[0].name, "Ekonomické a právne aspekty podnikania");
  assert.equal(parsed.summer[0].infoHref, "planinfo.php?id=2");
  assert.equal(parsed.summer[0].moodleHref, "https://vzdelavanie.uniza.sk/moodle/course/view.php?id=2");
});

test("AIVS grade dates map to the correct academic year", () => {
  assert.equal(getAcademicYearStartFromSlovakDate("22.9.2025"), 2025);
  assert.equal(getAcademicYearStartFromSlovakDate("16.2.2026"), 2025);
  assert.equal(getAcademicYearStartFromSlovakDate("31.8.2026"), 2025);
  assert.equal(getAcademicYearStartFromSlovakDate("1.9.2026"), 2026);
  assert.equal(getAcademicYearStartFromSlovakDate("31.2.2026"), null);
  assert.equal(getAcademicYearStartFromSlovakDate(""), null);
});

test("schedule progress is shown only for the currently selected day", () => {
  const duringClass = new Date("2026-03-09T09:30:00Z"); // 10:30 in Bratislava

  assert.deepEqual(getScheduleTiming("10:00", "11:00", duringClass, false), {
    isLive: false,
    progress: 0,
    minsLeft: 0,
  });
  assert.deepEqual(getScheduleTiming("10:00", "11:00", duringClass, true), {
    isLive: true,
    progress: 50,
    minsLeft: 30,
  });
});

test("schedule day and class time use the Bratislava timezone", () => {
  const mondayAfterDst = new Date("2026-04-06T08:30:00Z"); // 10:30 CEST

  assert.equal(getBratislavaDayIndex(mondayAfterDst), 1);
  assert.equal(getScheduleTiming("10:00", "11:00", mondayAfterDst, true).isLive, true);
});

test("subject info URLs are restricted to the official AIVS endpoint", () => {
  assert.equal(
    resolveSubjectInfoUrl("planinfo.php?id=42"),
    "https://vzdelavanie.uniza.sk/vzdelavanie/planinfo.php?id=42",
  );
  assert.equal(resolveSubjectInfoUrl("https://attacker.example/planinfo.php"), null);
  assert.equal(
    resolveSubjectInfoUrl("https://vzdelavanie.uniza.sk.attacker.example/vzdelavanie/planinfo.php"),
    null,
  );
  assert.equal(resolveSubjectInfoUrl("https://vzdelavanie.uniza.sk/moodle/course/view.php?id=1"), null);
});

test("Moodle links stay on approved UNIZA paths", () => {
  assert.equal(
    resolveMoodleUrl("https://vzdelavanie.uniza.sk/moodle/course/view.php?id=1"),
    "https://vzdelavanie.uniza.sk/moodle/course/view.php?id=1",
  );
  assert.equal(resolveMoodleUrl("javascript:alert(1)"), null);
  assert.equal(resolveMoodleUrl("https://example.com/moodle/course/view.php?id=1"), null);
});

test("exam action URLs are restricted to the official AIVS terms endpoint", () => {
  assert.equal(
    resolveExamTermsUrl("terminy_s.php?pid=register-7"),
    "https://vzdelavanie.uniza.sk/vzdelavanie/terminy_s.php?pid=register-7",
  );
  assert.equal(resolveExamTermsUrl("terminy_s.php"), null);
  assert.equal(resolveExamTermsUrl("https://example.com/vzdelavanie/terminy_s.php?pid=register-7"), null);
  assert.equal(resolveExamTermsUrl("javascript:alert(1)"), null);
});

test("academic year changes on 1 September in Bratislava", () => {
  assert.equal(getAcademicYear(new Date("2026-08-31T12:00:00Z")), "2025/2026");
  assert.equal(getAcademicYear(new Date("2026-09-01T12:00:00Z")), "2026/2027");
});

test("AIVS academic year selector is parsed from the upstream options", () => {
  const parsed = parseAcademicYears(`
    <select name="ra">
      <option value="2026" selected>2026 / 2027</option>
      <option value="2025">2025 / 2026</option>
      <option value="2024">2024 / 2025</option>
    </select>
  `);

  assert.equal(parsed.selectedStartYear, 2026);
  assert.deepEqual(parsed.options, [
    { startYear: 2026, label: "2026/2027" },
    { startYear: 2025, label: "2025/2026" },
    { startYear: 2024, label: "2024/2025" },
  ]);
});

test("WebKredit dates use Bratislava midnight across daylight-saving time", () => {
  assert.equal(localDateToUtcIso("2026-09-01"), "2026-08-31T22:00:00.000Z");
  assert.equal(localDateToUtcIso("2026-12-01"), "2026-11-30T23:00:00.000Z");
  assert.equal(getBratislavaDateKey("2026-08-31T22:00:00.000Z"), "2026-09-01");
  assert.deepEqual(listDateKeys("2026-12-30", 4), [
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
  ]);
});

test("current public WebKredit menu shape parses without an authenticated session", () => {
  const days = parseWebKreditMenu({
    groups: [{
      date: "2026-08-31T22:00:00.0000000Z",
      mealKindName: "Obed",
      rows: [{
        item: {
          date: "2026-08-31T22:00:00.0000000Z",
          canteenId: 1,
          mealKindId: 2,
          altId: 1,
          mealKindName: "Obed",
          mealName: "Kuracie stehno na paprike",
          mealSize: "350 g",
          price: 0,
          currency: "€",
          allergens: "lepok, mlieko",
          show: true,
        },
      }],
    }],
  });

  assert.equal(days.length, 1);
  assert.equal(days[0].date, "2026-09-01");
  assert.equal(days[0].groups[0].items[0].mealName, "Kuracie stehno na paprike");
  assert.equal(days[0].groups[0].items[0].allergens, "lepok, mlieko");
  assert.equal(days[0].groups[0].items[0].price, "");
  assert.equal(days[0].groups[0].items[0].id, "1-2026-09-01-2-1");
});

test("legacy WebKredit array shape and canteen catalogue stay supported", () => {
  const days = parseWebKreditMenu([{
    groups: [{
      date: "2026-11-30T23:00:00.000Z",
      mealKindName: "Obed",
      rows: [{ item: {
        date: "2026-11-30T23:00:00.000Z",
        canteenId: 3,
        altId: 4,
        mealName: "Fit menu",
        price: 2.5,
        currency: "€",
        allergens: ["lepok", "orechy"],
      } }],
    }],
  }]);
  const catalogue = parseWebKreditCanteens({
    canteenId: 1,
    canOrder: true,
    message: "Prevádzka je zatvorená",
    canteens: [
      { id: 1, name: "Nová Menza", code: "NM" },
      { id: 3, name: "Fakulta riadenia a inf.", code: "FRI" },
    ],
  });

  assert.equal(days[0].groups[0].items[0].price, "2,50 €");
  assert.equal(days[0].groups[0].items[0].allergens, "lepok, orechy");
  assert.equal(catalogue.canteens.length, 2);
  assert.equal(catalogue.selectedCanteenId, 1);
  assert.equal(catalogue.message, "Prevádzka je zatvorená");
  assert.equal(catalogue.canOrder, true);
});

test("WebKredit repeated menu rows are shown only once", () => {
  const repeatedRow = {
    item: {
      date: "2026-08-31T22:00:00.0000000Z",
      canteenId: 1,
      mealKindId: 2,
      altId: 1,
      mealKindName: "Obed",
      mealName: "Denné menu",
      show: true,
    },
  };
  const days = parseWebKreditMenu({
    groups: [{
      date: "2026-08-31T22:00:00.0000000Z",
      mealKindName: "Obed",
      rows: [repeatedRow, repeatedRow],
    }],
  });

  assert.equal(days[0].groups[0].items.length, 1);
});

test("WebKredit menu exposes order state and optional composite choices", () => {
  const [day] = parseWebKreditMenu({ groups: [{
    date: "2026-09-04T22:00:00.000Z",
    mealKindName: "Obed",
    rows: [{
      item: { date: "2026-09-04T22:00:00.000Z", canteenId: 1, mealKindId: 2, altId: 3, mealName: "Mix", state: 0, orderInAdvance: true, countAvailable: 8 },
      composites: { maxWeight: 350, items: [{ id: 11, altId: 1, name: "Ryža" }] },
    }],
  }] });
  const item = day.groups[0].items[0];
  assert.equal(item.canOrder, true);
  assert.equal(item.orderInAdvance, true);
  assert.equal(item.countAvailable, 8);
  assert.equal(item.compositeMaxWeight, 350);
  assert.deepEqual(item.composites, [{ id: 11, alternative: 1, name: "Ryža" }]);
});

test("WebKredit orders preserve only capabilities returned by the server", () => {
  const orders = parseWebKreditOrders({ items: [{ order: {
    id: 42, date: "2026-09-05T22:00:00.000Z", mealKindId: 2, mealKind: "Obed", alternative: 1,
    name: "Menu", canteenId: 3, canteen: "FRI", count: 1, canCancel: true, canChangeAlt: false, canChangeCanteen: true,
  }, alternatives: [{ id: 1, name: "Menu" }], canteens: [{ id: 3, name: "FRI", code: "FRI" }] }] });
  assert.equal(orders[0].id, "42");
  assert.equal(orders[0].canCancel, true);
  assert.equal(orders[0].canChangeAlternative, false);
  assert.equal(orders[0].canChangeCanteen, true);
});

test("WebKredit operation codes are normalized", () => {
  assert.deepEqual(parseWebKreditOperation({ results: [{ validationResult: 0, orderResult: 0, isSuccessful: true }] }), { successful: true, code: "success" });
  assert.deepEqual(parseWebKreditOperation({ results: [{ validationResult: 0, orderResult: 99993, isSuccessful: false }] }), { successful: false, code: "insufficient_funds" });
  assert.deepEqual(parseWebKreditOperation({ results: [{ validationResult: 43, orderResult: 0, isSuccessful: false }] }), { successful: false, code: "ordering_closed" });
});

test("AIVS exam terms parse data and expose only direct allowed actions", () => {
  const terms = parseAivsExamTerms(`<table>
    <tr><td>15.01.2027 / 09:00</td><td>RC006</td><td>Doc. Test</td><td>24</td><td>9</td><td>riadny termín</td><td>Bring ISIC</td><td><a href="terminy_s.php?pid=register-7"><img title="Prihlásenie na termín"></a><a href="terminy_s.php?pid=detail-7"><img title="Informácie o termíne"></a></td></tr>
    <tr><td>16.01.2027 / 09:00</td><td>RC006</td><td>Doc. Test</td><td>24</td><td>24</td><td>riadny termín</td><td></td><td><a href="javascript: alert('Kapacita termínu naplnená!');"><img title="Prihlásenie na termín"></a><a href="terminy_s.php?pid=detail-8"><img title="Informácie o termíne"></a></td></tr>
  </table>`, "Logické systémy", "6BI0019", 2026, "terminy_s.php?pid=list");
  assert.equal(terms.length, 2);
  assert.equal(terms[0].id, "detail-7");
  assert.equal(terms[0].canRegister, true);
  assert.equal(terms[1].canRegister, false);
  assert.equal(terms[0].capacity, 24);
  assert.equal(terms[0].occupied, 9);
});

test("ICS export uses Bratislava local time, stable IDs, and escaped text", () => {
  const calendar = createIcsCalendar([{ uid: "exam-42", title: "Math, exam", date: "2027-01-15", timeStart: "09:00", timeEnd: "10:00", location: "RC006", description: "Line 1\nLine 2" }]);
  assert.match(calendar, /DTSTART;TZID=Europe\/Bratislava:20270115T090000/);
  assert.match(calendar, /SUMMARY:Math\\, exam/);
  assert.match(calendar, /DESCRIPTION:Line 1\\nLine 2/);
  assert.match(calendar, /UID:[a-f0-9]+@uniza-student/);
});

test("ICS export gives events without an end time a one-hour duration", () => {
  const calendar = createIcsCalendar([{ uid: "exam-midnight", title: "Late exam", date: "2027-01-15", timeStart: "23:30" }]);
  assert.match(calendar, /DTSTART;TZID=Europe\/Bratislava:20270115T233000/);
  assert.match(calendar, /DTEND;TZID=Europe\/Bratislava:20270116T003000/);
});
