import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { SHOP } from "@/lib/shop";
import { bnNum } from "@/lib/format";
import { bengaliFonts, embeddedFontBase64 } from "@/assets/fonts";
import { normalizePdfText } from "./unicode";

import { PDF_PAGE, PDF_TYPE, planTables, fitCell, centeredTableHeaders } from "./pdf-layout";
import type { MeasureText, PdfSection } from "./pdf-layout";
export type { PdfSection } from "./pdf-layout";

export interface PdfDocument {
  title: string;
  subtitle: string;
  filename: string;
  sections: PdfSection[];
  note?: string;
}

// Lazy-load the PDF engine, but use checked-in fonts embedded at build time.
// Fontkit shapes Bengali GSUB/GPOS; consistent Unicode normalization avoids
// cache corruption when canonically equivalent spellings occur in one PDF.
let enginePromise: Promise<typeof import("pdfmake/build/pdfmake")> | undefined;
async function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { default: pdfMake } = await import("pdfmake/build/pdfmake");
      const entries = Object.values(bengaliFonts).map(({ filename, dataUrl }) => [
        filename,
        embeddedFontBase64(dataUrl),
      ]);
      pdfMake.addVirtualFileSystem(Object.fromEntries(entries));
      pdfMake.addFonts({
        Bengali: {
          normal: "NotoSansBengali-Regular.ttf",
          bold: "NotoSansBengali-Bold.ttf",
          italics: "NotoSansBengali-Regular.ttf",
          bolditalics: "NotoSansBengali-Bold.ttf",
        },
      });
      return pdfMake;
    })().catch((error) => {
      enginePromise = undefined; // A failed engine import must remain retryable.
      throw error;
    });
  }
  return enginePromise;
}

let logoPromise: Promise<string> | undefined;
async function loadLogo() {
  if (!logoPromise) {
    logoPromise = (async () => {
      const response = await fetch(SHOP.printLogo, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("প্রতিষ্ঠানের লোগো লোড করা যায়নি।");
      const bytes = new Uint8Array(await response.arrayBuffer());
      // A local black/white PNG derived from the original brand mark. The UI
      // keeps its color logo; downloads require no grayscale printer setting.
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (!signature.every((value, index) => bytes[index] === value))
        throw new Error("Invalid logo image");
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:image/png;base64,${btoa(binary)}`;
    })().catch((error) => {
      logoPromise = undefined;
      throw error;
    });
  }
  return logoPromise;
}

async function createTextMeasurer(): Promise<MeasureText> {
  await Promise.all(
    [400, 700].map((weight) => window.document.fonts.load(`${weight} 14px "Noto Sans Bengali"`)),
  );
  const context = window.document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Cannot measure PDF text");
  return (text, size, bold = false) => {
    context.font = `${bold ? 700 : 400} ${(size * 96) / 72}px "Noto Sans Bengali"`;
    // Reserve a small safety allowance between browser and PDF font shaping.
    return ((context.measureText(normalizePdfText(text)).width * 72) / 96) * 1.06;
  };
}

export function documentDefinition(
  document: PdfDocument,
  logo: string,
  measure: MeasureText,
): TDocumentDefinitions {
  // Work on copies so downloads never change the customer's saved records.
  document = {
    ...document,
    title: normalizePdfText(document.title),
    subtitle: normalizePdfText(document.subtitle),
    note: document.note ? normalizePdfText(document.note) : undefined,
    sections: document.sections.map((section) => ({
      ...section,
      title: section.title ? normalizePdfText(section.title) : undefined,
      headers: section.headers.map(normalizePdfText),
      rows: section.rows.map((row) => row.map(normalizePdfText)),
    })),
  };
  const plan = planTables(document.sections, measure);
  const ink = "#000000";
  const rule = (width = 0.5): Content => ({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: plan.contentWidth,
        y2: 0,
        lineWidth: width,
        lineColor: ink,
      },
    ],
  });
  const content: Content[] = [
    {
      stack: [
        { image: "shopLogo", fit: [44, 44], alignment: "center", margin: [0, 0, 0, 6] },
        { text: normalizePdfText(SHOP.name), fontSize: PDF_TYPE.heading, bold: true },
        { text: normalizePdfText(SHOP.tagline), fontSize: PDF_TYPE.caption, margin: [0, 2, 0, 0] },
        { text: normalizePdfText(SHOP.address), fontSize: PDF_TYPE.caption, margin: [0, 2, 0, 0] },
        { text: SHOP.phones.join(" • "), fontSize: PDF_TYPE.caption, margin: [0, 2, 0, 0] },
      ],
      alignment: "center",
      margin: [0, 0, 0, 12],
    },
    rule(1),
    {
      text: document.title,
      fontSize: PDF_TYPE.heading,
      bold: true,
      alignment: "center",
      margin: [0, 12, 0, 6],
    },
    {
      text: document.subtitle,
      fontSize: PDF_TYPE.caption,
      alignment: "center",
      margin: [0, 0, 0, 14],
    },
  ];
  for (const [sectionIndex, section] of document.sections.entries()) {
    const tablePlan = plan.tables[sectionIndex];
    if (section.title) content.push({ text: section.title, bold: true, margin: [0, 12, 0, 6] });
    if (!section.rows.length) {
      content.push({ text: "এই সময়ে কোনো ডাটা নেই", margin: [0, 6, 0, 12] });
      continue;
    }
    content.push({
      table: {
        headerRows: 1,
        widths: tablePlan.widths,
        keepWithHeaderRows: tablePlan.dontBreakRows ? 1 : 0,
        dontBreakRows: tablePlan.dontBreakRows,
        body: [
          centeredTableHeaders(section.headers),
          ...section.rows.map((row, rowIndex) =>
            row.map<TableCell>((text, index) => ({
              text,
              bold: section.emphasisRows?.includes(rowIndex) ?? false,
              alignment: tablePlan.alignments[index],
              ...fitCell(
                text,
                section.columns[index].kind,
                tablePlan.widths[index],
                (value, size) => measure(value, size, section.emphasisRows?.includes(rowIndex)),
              ),
              margin: [0, 2, 0, 2],
            })),
          ),
        ],
      },
      layout: {
        vLineWidth: () => PDF_PAGE.border,
        vLineColor: () => ink,
        hLineWidth: (index) =>
          index === 1 || section.emphasisRows?.includes(index - 1) ? 0.85 : PDF_PAGE.border,
        hLineColor: () => ink,
        paddingLeft: () => PDF_PAGE.padding,
        paddingRight: () => PDF_PAGE.padding,
        paddingTop: () => 3,
        paddingBottom: () => 3,
        fillColor: () => null,
      },
      margin: [0, 0, 0, 12],
    });
  }
  if (document.note)
    content.push({ text: [{ text: "নোট: ", bold: true }, document.note], margin: [0, 6, 0, 6] });
  content.push({
    unbreakable: true,
    columns: [
      { text: "", width: "*" },
      {
        width: 150,
        stack: [
          {
            canvas: [
              { type: "line", x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: ink },
            ],
          },
          {
            text: "মালিকের স্বাক্ষর",
            fontSize: PDF_TYPE.caption,
            alignment: "center",
            margin: [0, 5, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 28, 0, 0],
  });
  return {
    info: { title: document.title, author: normalizePdfText(SHOP.name) },
    images: { shopLogo: logo },
    pageSize: "A4",
    pageOrientation: plan.orientation,
    // Reserve space for the stacked, centered continuation header.
    pageMargins: [PDF_PAGE.margin, 74, PDF_PAGE.margin, 48],
    header: (page) =>
      page === 1
        ? { text: "" }
        : {
            stack: [
              { image: "shopLogo", fit: [18, 18], alignment: "center" },
              {
                text: normalizePdfText(SHOP.name),
                fontSize: PDF_TYPE.caption,
                bold: true,
                margin: [0, 2, 0, 0],
              },
              { text: document.title, fontSize: PDF_TYPE.caption },
            ],
            alignment: "center",
            margin: [PDF_PAGE.margin, 18, PDF_PAGE.margin, 0],
          },
    defaultStyle: { font: "Bengali", fontSize: PDF_TYPE.body, color: ink },
    content,
    footer: (page, count) => ({
      stack: [
        rule(),
        {
          columns: [
            { text: "", width: 80 },
            {
              text: normalizePdfText(SHOP.name),
              fontSize: PDF_TYPE.caption,
              alignment: "center",
              width: "*",
            },
            {
              width: 80,
              text: `পৃষ্ঠা ${bnNum(page)} / ${bnNum(count)}`,
              alignment: "right",
              fontSize: PDF_TYPE.caption,
            },
          ],
          margin: [0, 6, 0, 0],
        },
      ],
      margin: [PDF_PAGE.margin, 10, PDF_PAGE.margin, 0],
    }),
  };
}

export async function downloadPdf(document: PdfDocument) {
  const [pdfMake, logo, measure] = await Promise.all([
    loadEngine(),
    loadLogo(),
    createTextMeasurer(),
  ]);
  const blob = await pdfMake.createPdf(documentDefinition(document, logo, measure)).getBlob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.filename.replace(/[\\/:*?"<>|]/g, "-");
  window.document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Mobile browsers may consume the blob after the click handler returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
