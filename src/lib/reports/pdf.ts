import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { SHOP } from "@/lib/shop";
import { bengaliFonts, embeddedFontBase64 } from "@/assets/fonts";
import { normalizePdfText } from "./unicode";
import { reportDefinition } from "./report-definition";
import { posReceiptDefinition } from "./pos-receipt";

import type { MeasureText, PdfSection } from "./pdf-layout";
export type { PdfSection } from "./pdf-layout";

export interface PdfDocument {
  format?: "a4" | "pos80";
  receiptInfo?: { billNo: string; date: string; customerName: string };
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
  return document.format === "pos80"
    ? posReceiptDefinition(document, SHOP, logo)
    : reportDefinition(document, SHOP, measure);
}

export async function downloadPdf(document: PdfDocument) {
  const [pdfMake, logo, measure] = await Promise.all([
    loadEngine(),
    document.format === "pos80" ? loadLogo() : Promise.resolve(""),
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
