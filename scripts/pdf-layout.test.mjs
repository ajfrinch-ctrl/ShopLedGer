import assert from "node:assert/strict";
import { test } from "node:test";
import { columnAlignment, planTables, fitCell, PDF_PAGE } from "../src/lib/reports/pdf-layout.ts";

const measure = (text, size) => text.length * size * 0.55;
const sales = {
  headers: ["তারিখ", "ক্রেতা", "পণ্য", "মোট"],
  columns: [
    { kind: "date" },
    { kind: "text" },
    { kind: "text", minWidth: 140, weight: 5 },
    { kind: "money" },
  ],
  rows: [["২০ সেপ্টেম্বর ২০২৬", "করিম মিয়া", "পশুখাদ্য", "৳১০,৪১০"]],
};

test("date, phone and money use intentional column alignment", () => {
  assert.equal(columnAlignment("date"), "center");
  assert.equal(columnAlignment("phone"), "center");
  assert.equal(columnAlignment("money"), "right");
  assert.equal(columnAlignment("quantity"), "right");
  assert.equal(columnAlignment("text"), "left");
});

test("ordinary reports fill A4 within margins including padding", () => {
  const plan = planTables([sales], measure);
  assert.equal(plan.orientation, "portrait");
  const table = plan.tables[0];
  assert.ok(table.widths[2] > table.widths[3]);
  assert.ok(
    Math.abs(
      table.widths.reduce((a, b) => a + b, 0) + 4 * 2 * PDF_PAGE.padding - plan.contentWidth,
    ) < 0.001,
  );
  assert.equal(table.dontBreakRows, true);
});

test("wide financial reports choose landscape and keep complete numbers", () => {
  const section = {
    headers: ["তারিখ", "বেচা", "কেনা", "খরচ", "লাভ"],
    columns: [{ kind: "date" }, ...Array.from({ length: 4 }, () => ({ kind: "money" }))],
    rows: [["২০ সেপ্টেম্বর ২০২৬", ...Array(4).fill("−৳৯৯,৯৯,৯৯,৯৯,৯৯,৯৯৯")]],
  };
  const plan = planTables([section], measure);
  assert.equal(plan.orientation, "landscape");
  assert.ok(plan.tables[0].widths.every((width) => width > 0));
  assert.equal(
    fitCell(section.rows[0][1], "money", plan.tables[0].widths[1], measure).noWrap,
    true,
  );
});

test("oversized cells wrap instead of overflowing or silently losing data", () => {
  assert.equal(fitCell("৳" + "৯".repeat(80), "money", 80, measure).noWrap, false);
  assert.equal(fitCell("পণ্য ".repeat(1000), "text", 140, measure).noWrap, false);
  const plan = planTables(
    [{ ...sales, rows: [["তারিখ", "ক্রেতা", "বিবরণ ".repeat(1000), "৳১০"]] }],
    measure,
  );
  assert.equal(plan.tables[0].dontBreakRows, false);
});

test("empty reports work and inconsistent column counts fail loudly", () => {
  assert.equal(planTables([{ ...sales, rows: [] }], measure).orientation, "portrait");
  assert.throws(() => planTables([{ ...sales, rows: [["missing columns"]] }], measure));
});
