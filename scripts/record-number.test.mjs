import assert from "node:assert/strict";
import { test } from "node:test";
import { nextRecordNumber, RECORD_PREFIX } from "../src/lib/record-number.ts";
import { todayKey } from "../src/lib/format.ts";

test("references use prefix, YYMMDD and a daily minimum-three-digit sequence", () => {
  const first = nextRecordNumber("B", "2026-09-12", {}, []);
  assert.equal(first.number, "B-260912001");
  assert.equal(nextRecordNumber("B", "2026-09-12", first.sequences, []).number, "B-260912002");
  assert.equal(nextRecordNumber("B", "2026-09-13", first.sequences, []).number, "B-260913001");
  assert.equal(nextRecordNumber("C", "2026-09-12", first.sequences, []).number, "C-260912001");
  assert.equal(new Set(Object.values(RECORD_PREFIX)).size, Object.keys(RECORD_PREFIX).length);
});

test("deleted records, reloads and older dates never reuse reserved numbers", () => {
  const issued = nextRecordNumber("B", "2026-09-12", {}, []);
  const persisted = JSON.parse(JSON.stringify(issued.sequences));
  const tomorrow = nextRecordNumber("B", "2026-09-13", persisted, []);
  assert.equal(nextRecordNumber("B", "2026-09-12", tomorrow.sequences, []).number, "B-260912002");
});

test("existing references take precedence when counters are missing or behind", () => {
  const numbers = ["s-legacy", "বিল-১০৪৯", "B-260912009", "B-260912123", "B-260913999"];
  assert.equal(nextRecordNumber("B", "2026-09-12", {}, numbers).number, "B-260912124");
  assert.equal(
    nextRecordNumber("B", "2026-09-12", { "B-260912": 150 }, numbers).number,
    "B-260912151",
  );
});

test("sequence continues beyond 999 without truncation or collisions", () => {
  let sequences = {};
  const issued = new Set();
  for (let i = 1; i <= 1100; i++) {
    const next = nextRecordNumber("O", "2026-09-12", sequences, []);
    sequences = next.sequences;
    issued.add(next.number);
  }
  assert.equal(issued.size, 1100);
  assert.ok(issued.has("O-2609121000"));
});

test("date boundary uses Bangladesh time, independent of the browser timezone", () => {
  assert.equal(todayKey(new Date("2026-09-11T18:00:00Z")), "2026-09-12");
  assert.equal(todayKey(new Date("2026-09-11T17:59:59Z")), "2026-09-11");
  assert.throws(() => nextRecordNumber("B", "2026-02-30", {}, []));
  assert.throws(() => nextRecordNumber("B", "12-09-2026", {}, []));
  assert.throws(() => nextRecordNumber("B", "2026-09-12", { "B-260912": -1 }, []));
});
