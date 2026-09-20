import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { SHOP } from "@/lib/shop";
import { bnNum } from "@/lib/format";
import { bengaliFonts, embeddedFontBase64 } from "@/assets/fonts";
import { normalizePdfText } from "./unicode";

import { PDF_PAGE, PDF_TYPE, planTables, fitCell } from "./pdf-layout";
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
      const response = await fetch(SHOP.logo, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("প্রতিষ্ঠানের লোগো লোড করা যায়নি।");
      const bytes = new Uint8Array(await response.arrayBuffer());
      // The bundled logo is JPEG. Do not silently create an unbranded PDF.
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid logo image");
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:image/jpeg;base64,${btoa(binary)}`;
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
  const content: Content[] = [
    { image: "shopLogo", fit: [48, 48], alignment: "center", margin: [0, 0, 0, 6] },
    {
      text: normalizePdfText(SHOP.name),
      fontSize: PDF_TYPE.heading,
      bold: true,
      alignment: "center",
    },
    {
      text: normalizePdfText(SHOP.address),
      fontSize: PDF_TYPE.caption,
      alignment: "center",
      margin: [0, 4, 0, 0],
    },
    {
      text: normalizePdfText(SHOP.phones.join(" • ")),
      fontSize: PDF_TYPE.caption,
      alignment: "center",
    },
    { text: document.title, fontSize: PDF_TYPE.heading, bold: true, margin: [0, 16, 0, 4] },
    { text: document.subtitle, fontSize: PDF_TYPE.caption, margin: [0, 0, 0, 12] },
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
          section.headers.map((text, index) => ({
            text,
            bold: true,
            fillColor: "#e6f5ee",
            alignment: tablePlan.alignments[index],
            margin: [0, 3, 0, 3],
          })),
          ...section.rows.map((row) =>
            row.map<TableCell>((text, index) => ({
              text,
              alignment: tablePlan.alignments[index],
              ...fitCell(text, section.columns[index].kind, tablePlan.widths[index], measure),
              margin: [0, 3, 0, 3],
            })),
          ),
        ],
      },
      layout: {
        vLineWidth: () => 0,
        hLineWidth: (index) => (index === 1 ? 1 : 0.5),
        hLineColor: (index) => (index === 1 ? "#04795a" : "#dce5e0"),
        paddingLeft: () => PDF_PAGE.padding,
        paddingRight: () => PDF_PAGE.padding,
        paddingTop: () => 3,
        paddingBottom: () => 3,
        fillColor: (row) => (row > 0 && row % 2 === 0 ? "#f6faf8" : null),
      },
      margin: [0, 0, 0, 12],
    });
  }
  if (document.note) content.push({ text: document.note, margin: [0, 8, 0, 8] });
  content.push({ text: "মালিকের স্বাক্ষর ____________________", margin: [0, 24, 0, 0] });
  return {
    info: { title: document.title, author: normalizePdfText(SHOP.name) },
    images: { shopLogo: logo },
    pageSize: "A4",
    pageOrientation: plan.orientation,
    pageMargins: [PDF_PAGE.margin, 44, PDF_PAGE.margin, 45],
    header: (page) =>
      page === 1
        ? { text: "" }
        : {
            columns: [
              { image: "shopLogo", fit: [20, 20], width: 26 },
              {
                text: normalizePdfText(SHOP.name),
                fontSize: PDF_TYPE.caption,
                bold: true,
                margin: [0, 3, 0, 0],
              },
              {
                text: document.title,
                fontSize: PDF_TYPE.caption,
                alignment: "right",
                margin: [0, 3, 0, 0],
              },
            ],
            margin: [PDF_PAGE.margin, 10, PDF_PAGE.margin, 0],
          },
    defaultStyle: { font: "Bengali", fontSize: PDF_TYPE.body, color: "#14211c" },
    content,
    footer: (page, count) => ({
      text: `পৃষ্ঠা ${bnNum(page)} / ${bnNum(count)}`,
      alignment: "center",
      fontSize: PDF_TYPE.caption,
      margin: [0, 12, 0, 0],
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
