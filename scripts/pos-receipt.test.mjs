import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import pdfMake from "pdfmake/build/pdfmake.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { posReceiptDefinition, POS_PAGE } from "../src/lib/reports/pos-receipt.ts";
import { STATEMENT_FOOTER } from "../src/lib/reports/document-text.ts";

const root = new URL("../", import.meta.url);
const brand = {
  name: "কর্ণফুলী সেলস সেন্টার",
  tagline: "গবাদি পশুর খাদ্য সরবরাহ",
  address: "পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম",
  phones: ["01821989717", "01811808294"],
};
const logo =
  "data:image/png;base64," +
  readFileSync(new URL("public/brand/karnaphuli-mark-mono.png", root)).toString("base64");
for (const weight of ["Regular", "Bold"]) {
  const filename = `NotoSansBengali-${weight}.ttf`;
  pdfMake.addVirtualFileSystem({
    [filename]: readFileSync(new URL(`src/assets/fonts/${filename}`, root)).toString("base64"),
  });
}
pdfMake.addFonts({
  Bengali: { normal: "NotoSansBengali-Regular.ttf", bold: "NotoSansBengali-Bold.ttf" },
});

function receipt(items = 1) {
  return {
    format: "pos80",
    title: "বিক্রয় রসিদ",
    subtitle: "বিল-১০০ • করিম মিয়া",
    receiptInfo: { billNo: "বিল-১০০", date: "২১ সেপ্টেম্বর ২০২৬", customerName: "করিম মিয়া" },
    filename: "receipt-test.pdf",
    sections: [
      {
        headers: ["পণ্য", "পরিমাণ", "দর", "মোট"],
        columns: [{ kind: "text" }, { kind: "quantity" }, { kind: "money" }, { kind: "money" }],
        rows: Array.from({ length: items }, (_, i) => [
          `কোয়ালিটি লেয়ার খাদ্য ${i + 1}`,
          "২.৫ বস্তা",
          "৳১২০",
          "৳৩০০",
        ]),
      },
      {
        headers: ["বিবরণ", "টাকা"],
        columns: [{ kind: "text" }, { kind: "money" }],
        emphasisRows: [2, 4],
        rows: [
          ["উপমোট", "৳৪,২০০"],
          ["ছাড়", "৳১০০"],
          ["সর্বমোট", "৳৪,১০০"],
          ["জমা", "৳১,৫০০"],
          ["বাকি", "৳২,৬০০"],
        ],
      },
    ],
    note: "পণ্য বুঝে পেয়েছি। NOTE-END",
  };
}

async function render(document) {
  const bytes = await pdfMake.createPdf(posReceiptDefinition(document, brand, logo)).getBuffer();
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise;
    assert.equal(pdf.numPages, 1);
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    assert.ok(Math.abs((viewport.width * 25.4) / 72 - 80) < 0.01);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item && item.str.trim());
    for (const item of items) {
      const [x, y] = item.transform.slice(4);
      assert.ok(
        x >= POS_PAGE.margin - 1 && x + item.width <= viewport.width - POS_PAGE.margin + 1,
        `Horizontal clipping: ${item.str}`,
      );
      assert.ok(
        y >= POS_PAGE.margin - 1 && y <= viewport.height - POS_PAGE.margin + 1,
        `Vertical clipping: ${item.str}`,
      );
    }
    // There is no A4-sized empty tail after the auto-height receipt footer.
    const bottom = Math.min(...items.map((item) => item.transform[5]));
    assert.ok(bottom >= POS_PAGE.margin - 1 && bottom < POS_PAGE.margin + 12);
    return { height: viewport.height, text: items.map((item) => item.str).join(" "), positions: items };
  } finally {
    await task.destroy();
  }
}

test("80mm receipt uses full-width names, centered headers, saved values and a signature-free footer", () => {
  const document = receipt();
  const before = JSON.stringify(document);
  const definition = posReceiptDefinition(document, brand, logo);
  assert.deepEqual(definition.pageSize, { width: POS_PAGE.width, height: "auto" });
  assert.ok(Math.abs((POS_PAGE.margin * 25.4) / 72 - 4) < 0.001);
  const tables = definition.content.filter((node) => node.table);
  assert.equal(tables[0].table.body[1][0].colSpan, 2);
  assert.equal(tables[0].table.body[2][0].text, "২.৫ বস্তা × ৳১২০");
  assert.equal(tables[0].table.body[2][1].alignment, "right");
  assert.ok(
    tables.every((node) => node.table.body[0].every((cell) => cell.alignment === "center")),
  );
  assert.equal(tables[1].table.body[3][1].bold, true);
  assert.equal(tables[1].table.body[5][1].bold, true);
  assert.equal(definition.content.at(-1).text, STATEMENT_FOOTER.normalize("NFC"));
  assert.equal(definition.footer, undefined, "Auto-height footer belongs in the content flow");
  assert.ok(!JSON.stringify(definition).includes("মালিকের স্বাক্ষর"));
  assert.equal(JSON.stringify(document), before, "Do not rewrite saved records");
});

test("short POS PDF keeps fractional quantities, unit prices, summary and notes in readable embedded text", async () => {
  const result = await render(receipt());
  for (const value of [
    "২.৫",
    "৳১২০",
    "৳৩০০",
    "৳৪,২০০",
    "৳১০০",
    "৳৪,১০০",
    "৳১,৫০০",
    "৳২,৬০০",
    "NOTE-END",
  ]) {
    assert.ok(result.text.includes(value), `Missing ${value}`);
  }
  assert.ok(result.height < 600, "Short sale must not leave a full A4 sheet of whitespace");
});

test("POS roll grows for long names, customers, notes and many items without losing the final row", async () => {
  const short = await render(receipt());
  const long = receipt(50);
  long.receiptInfo.customerName = "করিম মিয়া ".repeat(20);
  for (const row of long.sections[0].rows) row[0] += " দীর্ঘ পণ্যের বিবরণ ".repeat(5);
  long.sections[0].rows.at(-1)[0] += " FINAL-ITEM";
  long.note = "দীর্ঘ নোট ".repeat(80) + " NOTE-END";
  const result = await render(long);
  assert.ok(result.height > short.height * 4);
  assert.ok(result.text.replace(/\s+/g, "").includes("FINAL-ITEM"));
  assert.ok(result.text.includes("NOTE-END"));
  assert.ok(result.text.includes("৳২,৬০০"));
});

test("POS receipt prints customer mobile and address directly under the customer name", async () => {
  const document = receipt(1);
  document.receiptInfo.customerPhone = "01900000000";
  document.receiptInfo.customerAddress = "পদুয়া, বোয়ালখালী, চট্টগ্রাম";
  // Deterministic structure: name first, then mobile, then address.
  const definition = posReceiptDefinition(document, brand, logo);
  const lines = definition.content
    .filter((node) => typeof node.text === "string")
    .map((node) => node.text);
  assert.deepEqual(lines.slice(0, 5), [
    `বিল: ${document.receiptInfo.billNo}`,
    `তারিখ: ${document.receiptInfo.date}`,
    `ক্রেতা: ${document.receiptInfo.customerName}`,
    `মোবাইল: ${document.receiptInfo.customerPhone}`,
    `ঠিকানা: ${document.receiptInfo.customerAddress}`,
  ].map((value) => value.normalize("NFC")));
  const result = await render(document);
  // pdfjs reorders Bengali vowel signs in extraction, so anchor on the
  // ASCII-stable phone number and the distinctive address fragment.
  const roundY = (item) => Math.round(item.transform[5] * 2) / 2;
  const ys = [...new Set(result.positions.map(roundY))].sort((a, b) => b - a);
  const phoneY = roundY(result.positions.find((item) => item.str.includes("01900000000")));
  const index = ys.indexOf(phoneY);
  const lineText = (y) =>
    result.positions.filter((item) => Math.abs(roundY(item) - y) < 0.6).map((item) => item.str).join("");
  assert.ok(index > 0 && lineText(ys[index - 1]), "A customer line sits above the mobile");
  assert.ok(lineText(ys[index + 1]).includes("পদুয়া"), "Address line sits under the mobile");
});

test("POS receipt omits customer contact lines when the sale has no customer", async () => {
  const document = receipt(1);
  const definition = posReceiptDefinition(document, brand, logo);
  const lines = definition.content
    .filter((node) => typeof node.text === "string")
    .map((node) => node.text);
  assert.deepEqual(lines.slice(0, 3), [
    `বিল: ${document.receiptInfo.billNo}`,
    `তারিখ: ${document.receiptInfo.date}`,
    `ক্রেতা: ${document.receiptInfo.customerName}`,
  ].map((value) => value.normalize("NFC")));
  const result = await render(document);
  assert.ok(!result.text.includes("01900000000"), "No invented mobile");
});

test("empty and large-value POS receipts remain inside the 72mm printable area", async () => {
  await render(receipt(0));
  const large = receipt();
  large.sections[0].rows[0] = [
    "X".repeat(160),
    "১২৩৪৫.২৫ বস্তা",
    "−৳৯৯,৯৯,৯৯,৯৯৯",
    "৳৯৯,৯৯,৯৯,৯৯৯",
  ];
  large.sections[1].rows[4][1] = "−৳৯৯,৯৯,৯৯,৯৯৯";
  const result = await render(large);
  assert.ok(result.text.includes("NOTE-END"));
});
