import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { SHOP } from "@/lib/shop";
import { bnNum } from "@/lib/format";

export interface PdfSection {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface PdfDocument {
  title: string;
  subtitle: string;
  filename: string;
  sections: PdfSection[];
  note?: string;
}

// Lazy-loaded and same-origin: works at / and on GitHub Pages' /ShopLedGer/.
// PDFKit/fontkit inside pdfmake handles Bengali GSUB/GPOS shaping; Helvetica
// (jsPDF's default) cannot encode Bengali, even when doc.text receives Unicode.
let enginePromise: Promise<typeof import("pdfmake/build/pdfmake")> | undefined;
async function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { default: pdfMake } = await import("pdfmake/build/pdfmake");
      const entries = await Promise.all(
        ["Regular", "Bold"].map(async (weight) => {
          const name = `NotoSansBengali-${weight}.ttf`;
          const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`, {
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("বাংলা ফন্ট লোড করা যায়নি। আবার চেষ্টা করুন।");
          const bytes = new Uint8Array(await response.arrayBuffer());
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          return [name, btoa(binary)];
        }),
      );
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
      enginePromise = undefined; // A failed font request must remain retryable.
      throw error;
    });
  }
  return enginePromise;
}

// Match the UI roles in styles.css. PDF points = CSS pixels × 72 / 96.
const PDF_TYPE = { heading: 13.5, body: 10.5, caption: 9 } as const;

export function documentDefinition(document: PdfDocument): TDocumentDefinitions {
  const content: Content[] = [
    { text: SHOP.name, fontSize: PDF_TYPE.heading, bold: true, alignment: "center" },
    { text: SHOP.address, fontSize: PDF_TYPE.caption, alignment: "center", margin: [0, 4, 0, 0] },
    { text: SHOP.phones.join(" • "), fontSize: PDF_TYPE.caption, alignment: "center" },
    { text: document.title, fontSize: PDF_TYPE.heading, bold: true, margin: [0, 16, 0, 4] },
    { text: document.subtitle, fontSize: PDF_TYPE.caption, margin: [0, 0, 0, 12] },
  ];
  for (const section of document.sections) {
    if (section.title) content.push({ text: section.title, bold: true, margin: [0, 12, 0, 6] });
    if (!section.rows.length) {
      content.push({ text: "এই সময়ে কোনো ডাটা নেই", margin: [0, 6, 0, 12] });
      continue;
    }
    content.push({
      table: {
        headerRows: 1,
        widths: section.headers.map(() => "*"),
        body: [
          section.headers.map((text) => ({ text, bold: true, fillColor: "#e6f5ee" })),
          ...section.rows,
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 12],
    });
  }
  if (document.note) content.push({ text: document.note, margin: [0, 8, 0, 8] });
  content.push({ text: "মালিকের স্বাক্ষর ____________________", margin: [0, 24, 0, 0] });
  return {
    info: { title: document.title, author: SHOP.name },
    pageSize: "A4",
    pageMargins: [34, 34, 34, 45],
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
  const pdfMake = await loadEngine();
  const blob = await pdfMake.createPdf(documentDefinition(document)).getBlob();
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
