import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import pdfMake from "pdfmake/build/pdfmake.js";
import { create } from "fontkit";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { reportDefinition, REPORT_COLORS } from "../src/lib/reports/report-definition.ts";

const fonts = {};
for (const weight of ["Regular", "Bold"]) {
  const bytes = readFileSync(
    new URL(`../src/assets/fonts/NotoSansBengali-${weight}.ttf`, import.meta.url),
  );
  pdfMake.addVirtualFileSystem({ [weight]: bytes.toString("base64") });
  fonts[weight] = create(bytes);
}
pdfMake.addFonts({ Bengali: { normal: "Regular", bold: "Bold" } });
const measure = (text, size, bold = false) =>
  ((fonts[bold ? "Bold" : "Regular"]
    .layout(text.normalize("NFC"))
    .positions.reduce((sum, p) => sum + p.xAdvance, 0) *
    size) /
    1000) *
  1.06;
const brand = {
  name: "কর্ণফুলী সেলস সেন্টার",
  tagline: "গবাদি পশুর খাদ্য সরবরাহ",
  address: "আমুচিয়া, বোয়ালখালী, চট্টগ্রাম",
  phones: ["01821989717", "01811808294"],
};
const report = (rows = 10) => ({
  title: "স্টক রিপোর্ট",
  subtitle: "বর্তমান অবস্থা ২১ সেপ্টেম্বর, ২০২৬",
  filename: "stock.pdf",
  sections: [
    {
      headers: ["আইডি", "পণ্য", "শুরুর মজুদ", "বিক্রি", "বর্তমান মজুদ"],
      columns: [
        { kind: "id", minWidth: 38 },
        { kind: "text", minWidth: 170, weight: 5 },
        ...Array.from({ length: 3 }, () => ({ kind: "quantity", minWidth: 60 })),
      ],
      rows: Array.from({ length: rows }, (_, i) => [
        `p-${i + 1}`,
        "কোয়ালিটি লেয়ার ৫০ কেজি",
        "১৮ বস্তা",
        "১ বস্তা",
        "১৭ বস্তা",
      ]),
    },
  ],
});

async function render(document) {
  const bytes = await pdfMake.createPdf(reportDefinition(document, brand, measure)).getBuffer();
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const view = page.getViewport({ scale: 1 });
      const ops = await page.getOperatorList();
      assert.ok(!ops.fnArray.includes(OPS.paintImageXObject), "Reference reports have no logo");
      const colors = ops.fnArray.flatMap((op, i) =>
        op === OPS.setFillRGBColor ? [ops.argsArray[i][0]] : [],
      );
      assert.ok(colors.every((color) => Object.values(REPORT_COLORS).includes(color)));
      const items = (await page.getTextContent()).items.filter(
        (item) => "str" in item && item.str.trim(),
      );
      for (const item of items) {
        assert.ok(
          item.transform[4] >= 41.5 && item.transform[4] + item.width <= view.width - 41.5,
          item.str,
        );
        assert.ok(item.transform[5] > 20 && item.transform[5] < view.height - 8, item.str);
      }
      const notice = items
        .filter((item) => item.str.includes("—"))
        .sort((a, b) => a.transform[5] - b.transform[5])[0];
      assert.ok(notice, `Statement notice on page ${pageIndex}`);
      const noticeY = notice.transform[5];
      for (const row of [
        items.filter((item) => Math.abs(item.transform[5] - noticeY) < 0.5),
        items.filter((item) => item.transform[5] < noticeY - 1),
      ]) {
        assert.ok(row.length);
        const left = Math.min(...row.map((item) => item.transform[4]));
        const right = Math.max(...row.map((item) => item.transform[4] + item.width));
        assert.ok(
          Math.abs((left + right) / 2 - view.width / 2) < 1,
          "Footer and page count must be centered",
        );
      }
      const text = items.map((item) => item.str).join(" ");
      assert.ok(
        text.includes(
          `${pageIndex.toLocaleString("bn-BD")} / ${pdf.numPages.toLocaleString("bn-BD")}`,
        ),
      );
      pages.push({ items, colors, noticeY, height: view.height, text });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

test("reference-style reports use navy/white headers, alternate blue rows and centered stock figures", () => {
  const document = report();
  const original = JSON.stringify(document);
  const definition = reportDefinition(document, brand, measure);
  const table = definition.content.find((node) => node.table);
  assert.ok(
    table.table.body[0].every(
      (cell) =>
        cell.fillColor === "#203864" && cell.color === "#ffffff" && cell.alignment === "center",
    ),
  );
  assert.equal(table.layout.fillColor(1), "#ffffff");
  assert.equal(table.layout.fillColor(2), "#e8eff7");
  assert.deepEqual(
    table.table.body[1].map((cell) => cell.alignment),
    ["center", "left", "center", "center", "center"],
  );
  assert.equal(definition.images, undefined);
  assert.equal(JSON.stringify(document), original);
});

test("short A4 report places its statement and page count just below the table", async () => {
  const pages = await render(report());
  assert.equal(pages.length, 1);
  assert.ok(pages[0].colors.includes(REPORT_COLORS.header));
  assert.ok(pages[0].colors.includes(REPORT_COLORS.stripe));
  const finalRow = pages[0].items.find((item) => item.str === "p-10");
  assert.ok(finalRow);
  const gap = finalRow.transform[5] - pages[0].noticeY;
  assert.ok(gap > 15 && gap < 45, `Footer should follow the last row, gap=${gap}`);
  assert.ok(
    pages[0].noticeY > pages[0].height / 2,
    "No footer stranded at the bottom of a mostly blank sheet",
  );
});

test("long reports repeat blue headers and keep page counters and final-row footer intact", async () => {
  const document = report(140);
  for (const row of document.sections[0].rows) row[1] += " দীর্ঘ বিবরণ ".repeat(8);
  const pages = await render(document);
  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.colors.includes(REPORT_COLORS.header)));
  assert.ok(pages.at(-1).text.includes("p-140"));
});

test("empty reports and a multi-page single row retain their final footer and note", async () => {
  assert.equal((await render(report(0))).length, 1);
  const document = report(1);
  document.sections[0].rows[0][1] = "দীর্ঘ পণ্যের বিবরণ ".repeat(400) + " TAIL-MARKER";
  document.note = "NOTE-END";
  const pages = await render(document);
  assert.ok(pages.length > 1);
  assert.ok(
    pages
      .map((page) => page.text)
      .join("")
      .replace(/\s/g, "")
      .includes("TAIL-MARKER"),
  );
  assert.ok(pages.at(-1).text.includes("NOTE-END"));
});
