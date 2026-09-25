import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { SHOP } from "@/lib/shop";
import { bengaliFonts, embeddedFontBase64 } from "@/assets/fonts";
import { normalizePdfText } from "./unicode";
import { reportDefinition } from "./report-definition";
import { posReceiptDefinition } from "./pos-receipt";
import { a5ReceiptDefinition } from "./a5-receipt";

import type { MeasureText, PdfSection } from "./pdf-layout";
export type { PdfSection } from "./pdf-layout";

export interface PdfDocument {
  format?: "a4" | "pos80" | "receipt-a5";
  receiptInfo?: {
    billNo: string;
    date: string;
    customerName: string;
    /** ক্রেতার নামের নিচে প্রদর্শন করা মোবাইল নম্বর (অনুপস্থিত থাকলে সারি বাদ)। */
    customerPhone?: string;
    /** ক্রেতার নামের নিচে প্রদর্শন করা ঠিকানা (খালি থাকলে সারি বাদ)। */
    customerAddress?: string;
  };
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

const logoPromises = new Map<string, Promise<string>>();
async function loadLogo(monochrome: boolean) {
  const path = monochrome ? SHOP.printLogo : SHOP.logo;
  let promise = logoPromises.get(path);
  if (!promise) {
    promise = (async () => {
      const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("প্রতিষ্ঠানের লোগো লোড করা যায়নি।");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const signature = monochrome ? [137, 80, 78, 71, 13, 10, 26, 10] : [255, 216, 255];
      if (!signature.every((value, index) => bytes[index] === value))
        throw new Error("Invalid logo image");
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `data:image/${monochrome ? "png" : "jpeg"};base64,${btoa(binary)}`;
    })().catch((error) => {
      logoPromises.delete(path);
      throw error;
    });
    logoPromises.set(path, promise);
  }
  return promise;
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

async function loadReportLogo(): Promise<string> {
  if (SHOP.logo.startsWith("data:image/")) return SHOP.logo;
  const response = await fetch(SHOP.logo, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("প্রতিষ্ঠানের লোগো লোড করা যায়নি।");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function documentDefinition(
  document: PdfDocument,
  logo: string,
  measure: MeasureText,
): TDocumentDefinitions {
  if (document.format === "receipt-a5") return a5ReceiptDefinition(document, SHOP, logo, measure);
  return document.format === "pos80"
    ? posReceiptDefinition(document, SHOP, logo)
    : reportDefinition(document, SHOP, measure, logo || undefined);
}

export async function createPdfBlob(document: PdfDocument): Promise<Blob> {
  const [pdfMake, logo, measure] = await Promise.all([
    loadEngine(),
    document.format === "pos80" || document.format === "receipt-a5"
      ? loadLogo(document.format === "pos80")
      : loadReportLogo(),
    createTextMeasurer(),
  ]);
  return pdfMake.createPdf(documentDefinition(document, logo, measure)).getBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[\\/:*?"<>|]/g, "-");
  window.document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Mobile browsers may consume the blob after the click handler returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export async function downloadPdf(document: PdfDocument) {
  const blob = await createPdfBlob(document);
  downloadBlob(blob, document.filename);
}
