import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import pdfMake from "pdfmake/build/pdfmake.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  a5ReceiptDefinition,
  RECEIPT_PAGE,
  RECEIPT_COLORS,
} from "../src/lib/reports/a5-receipt.ts";
import { create } from "fontkit";
const fonts = {};
import { STATEMENT_FOOTER } from "../src/lib/reports/document-text.ts";

const root = new URL("../", import.meta.url);
const brand = {
  name: "কর্ণফুলী সেলস সেন্টার",
  tagline: "গবাদি পশুর খাদ্য সরবরাহ",
  address: "পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম",
  phones: ["01821989717", "01811808294"],
};
const logo =
  "data:image/jpeg;base64," +
  readFileSync(new URL("public/brand/karnaphuli-mark.jpg", root)).toString("base64");
for (const weight of ["Regular", "Bold"]) {
  const filename = `NotoSansBengali-${weight}.ttf`;
  fonts[weight] = create(readFileSync(new URL(`src/assets/fonts/${filename}`, root)));
  pdfMake.addVirtualFileSystem({
    [filename]: readFileSync(new URL(`src/assets/fonts/${filename}`, root)).toString("base64"),
  });
}
pdfMake.addFonts({
  Bengali: { normal: "NotoSansBengali-Regular.ttf", bold: "NotoSansBengali-Bold.ttf" },
});

const measure = (text, size, bold = false) =>
  ((fonts[bold ? "Bold" : "Regular"]
    .layout(text.normalize("NFC"))
    .positions.reduce((sum, p) => sum + p.xAdvance, 0) *
    size) /
    1000) *
  1.06;

function receipt(items = 1) {
  return {
    format: "receipt-a5",
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
  const bytes = await pdfMake
    .createPdf(a5ReceiptDefinition(document, brand, logo, measure))
    .getBuffer();
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise;
    let text = "";
    const positions = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const view = page.getViewport({ scale: 1 });
      assert.ok(
        Math.abs(view.width - RECEIPT_PAGE.width) < 0.01 &&
          Math.abs(view.height - RECEIPT_PAGE.height) < 0.01,
      );
      const items = (await page.getTextContent()).items.filter(
        (item) => "str" in item && item.str.trim(),
      );
      for (const item of items) {
        const [x, y] = item.transform.slice(4);
        assert.ok(
          x >= RECEIPT_PAGE.margin - 1 && x + item.width <= view.width - RECEIPT_PAGE.margin + 1,
          `Horizontal clipping: ${item.str}`,
        );
        assert.ok(y >= 8 && y <= view.height - 8, `Vertical clipping: ${item.str}`);
      }
      const pageText = items.map((item) => item.str).join(" ");
      assert.ok(pageText.includes("—"), "Every page retains the signature-free notice");
      assert.ok(
        pageText.includes(`${i.toLocaleString("bn-BD")} / ${pdf.numPages.toLocaleString("bn-BD")}`),
      );
      text += pageText;
      positions.push(...items);
    }
    return { text, pages: pdf.numPages, positions };
  } finally {
    await task.destroy();
  }
}

test("A5 reference receipt keeps four columns, green branding, right-aligned totals and red due", () => {
  const document = receipt();
  const before = JSON.stringify(document);
  const definition = a5ReceiptDefinition(document, brand, logo, measure);
  assert.equal(definition.pageSize, "A5");
  assert.equal(definition.pageOrientation, "portrait");
  const tables = definition.content.filter((node) => node.table);
  const items = tables[1].table.body;
  assert.equal(items[0].length, 4);
  assert.ok(
    items[0].every(
      (cell) => cell.alignment === "center" && cell.fillColor === RECEIPT_COLORS.header,
    ),
  );
  assert.equal(items[1][1].text, "২.৫ বস্তা");
  assert.equal(items[1][2].text, "৳১২০");
  const summary = tables[2].table.body;
  assert.ok(summary[2].every((cell) => cell.bold));
  assert.ok(summary[4].every((cell) => cell.bold && cell.color === RECEIPT_COLORS.due));
  assert.equal(summary[4][1].text, "৳২,৬০০");
  assert.ok(
    JSON.stringify(definition.footer(1, 1, { height: 595.28 })).includes(
      STATEMENT_FOOTER.normalize("NFC"),
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(definition),
    /মালিকের স্বাক্ষর|কোনো অভিযোগ|ব্যাংক|প্রস্তুতকারক/,
  );
  assert.equal(
    JSON.stringify(document),
    before,
    "Never rewrite saved records or infer weights from names",
  );
});

test("short A5 receipt fits one page with complete fractional quantities, saved prices, discount, payment and note", async () => {
  const result = await render(receipt(2));
  assert.equal(result.pages, 1);
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
  ])
    assert.ok(result.text.includes(value), `Missing ${value}`);
});

test("long A5 receipt repeats headers, paginates and preserves the last item and note", async () => {
  const document = receipt(50);
  document.receiptInfo.customerName = "করিম মিয়া ".repeat(10);
  for (const row of document.sections[0].rows) row[0] += " দীর্ঘ পণ্যের বিবরণ ".repeat(5);
  document.sections[0].rows.at(-1)[0] += " FINAL-ITEM";
  document.note = "দীর্ঘ নোট ".repeat(40) + " NOTE-END";
  const result = await render(document);
  assert.ok(result.pages > 1);
  assert.ok(result.text.replace(/\s+/g, "").includes("FINAL-ITEM"));
  assert.ok(result.text.includes("NOTE-END"));
  assert.ok(result.text.includes("৳২,৬০০"));
});

test("A5 receipt prints customer mobile and address directly under the customer name", async () => {
  const document = receipt(1);
  document.receiptInfo.customerPhone = "01900000000";
  document.receiptInfo.customerAddress = "পদুয়া, বোয়ালখালী, চট্টগ্রাম";
  // Deterministic structure: name first, then mobile, then address.
  const definition = a5ReceiptDefinition(document, brand, logo, measure);
  const info = definition.content.find((node) =>
    (node.columns?.[0]?.stack ?? []).some((line) => line.text?.normalize("NFC").startsWith("ক্রেতা".normalize("NFC"))),
  );
  assert.ok(info, "Customer info block missing from the definition");
  assert.deepEqual(
    info.columns[0].stack.map((line) => line.text),
    [
      `ক্রেতা: ${document.receiptInfo.customerName}`,
      `মোবাইল: ${document.receiptInfo.customerPhone}`,
      `ঠিকানা: ${document.receiptInfo.customerAddress}`,
    ].map((value) => value.normalize("NFC")),
  );
  const result = await render(document);
  // pdfjs reorders Bengali vowel signs in extraction, so anchor on the
  // ASCII-stable phone number and the Bengali-digit bill number.
  const roundY = (item) => Math.round(item.transform[5] * 2) / 2;
  const billY = result.positions.find((item) => item.str.includes("১০০")).transform[5];
  const leftLines = [...new Set(
    result.positions
      .filter((item) => item.transform[4] < 300 && item.transform[5] < billY - 1 && item.transform[5] > billY - 40)
      .map(roundY),
  )].sort((a, b) => b - a);
  const lineText = (y) =>
    result.positions.filter((item) => Math.abs(roundY(item) - y) < 0.6 && item.transform[4] < 300).map((item) => item.str).join("");
  assert.equal(leftLines.length, 2, "Mobile and address occupy the two lines under the name");
  assert.ok(lineText(leftLines[0]).includes("01900000000"), "First line under the name is the mobile");
  assert.ok(lineText(leftLines[1]).includes("পদুয়া"), "Second line under the name is the address");
});

test("A5 receipt omits customer contact lines when the sale has no customer", async () => {
  const document = receipt(1);
  const definition = a5ReceiptDefinition(document, brand, logo, measure);
  const info = definition.content.find((node) =>
    (node.columns?.[0]?.stack ?? []).some((line) => line.text?.normalize("NFC").startsWith("ক্রেতা".normalize("NFC"))),
  );
  assert.equal(info.columns[0].stack.length, 1, "Only the customer name remains for cash sales");
  const result = await render(document);
  assert.ok(!result.text.includes("01900000000"), "No invented mobile");
});

test("empty, huge-value and taller-than-a-page item receipts keep all data within A5 margins", async () => {
  await render(receipt(0));
  const document = receipt();
  document.sections[0].rows[0] = [
    "দীর্ঘ বিবরণ ".repeat(400) + " TAIL-MARKER",
    "১২৩৪৫.২৫ বস্তা",
    "−৳৯৯,৯৯,৯৯,৯৯৯",
    "৳৯৯,৯৯,৯৯,৯৯৯",
  ];
  document.sections[1].rows[4][1] = "−৳৯৯,৯৯,৯৯,৯৯৯";
  const result = await render(document);
  assert.ok(result.pages > 1);
  assert.ok(result.text.replace(/\s+/g, "").includes("TAIL-MARKER"));
  assert.ok(result.text.includes("NOTE-END"));
});
