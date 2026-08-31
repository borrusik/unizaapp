import assert from "node:assert/strict";
import test from "node:test";

import {
  getAcademicYear,
  resolveMoodleUrl,
  resolveSubjectInfoUrl,
} from "./uniza.ts";

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
