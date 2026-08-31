import assert from "node:assert/strict";
import test from "node:test";

import {
  getAcademicYear,
  resolveMoodleUrl,
  resolveSubjectInfoUrl,
} from "./uniza.ts";
import {
  getBratislavaDateKey,
  listDateKeys,
  localDateToUtcIso,
  parseAcademicYears,
  parseWebKreditCanteens,
  parseWebKreditMenu,
} from "./uniza-parsers.ts";

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
});
