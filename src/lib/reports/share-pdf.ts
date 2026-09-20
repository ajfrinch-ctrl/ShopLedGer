import { whatsappNumber } from "@/lib/format";
import type { PdfDocument } from "./pdf";
import { createPdfBlob, downloadBlob } from "./pdf";
import { renderPdfPagesToImages } from "./render-pdf-image";

export type PdfShareResult = "shared" | "cancelled" | "fallback";

type ShareFile = { blob: Blob; filename: string };

/**
 * Creates a PDF and offers it to the phone's native share sheet. Browsers do
 * not allow a website to choose WhatsApp's recipient or attach a local file to
 * a wa.me URL, so older browsers fall back to downloading the PDF and opening
 * the customer's WhatsApp chat with a ready-made message.
 */
export async function sharePdfToWhatsApp(input: {
  document: PdfDocument;
  phone: string;
  text: string;
}): Promise<PdfShareResult> {
  const blob = await createPdfBlob(input.document);
  return shareFilesToWhatsApp({
    files: [{ blob, filename: input.document.filename }],
    phone: input.phone,
    text: input.text,
    title: input.document.title,
  });
}

/** Render the exact PDF pages as PNGs, then offer those images to WhatsApp. */
export async function sharePdfImagesToWhatsApp(input: {
  document: PdfDocument;
  phone: string;
  text: string;
}): Promise<PdfShareResult> {
  const blob = await createPdfBlob(input.document);
  const images = await renderPdfPagesToImages(blob, input.document.filename);
  return shareFilesToWhatsApp({
    files: images,
    phone: input.phone,
    text: input.text.replace("PDF", "ছবি"),
    title: `${input.document.title} — ছবি`,
  });
}

async function shareFilesToWhatsApp(input: {
  files: ShareFile[];
  phone: string;
  text: string;
  title: string;
}): Promise<PdfShareResult> {
  if (!input.files.length) throw new Error("কোনো ছবি তৈরি হয়নি");
  const files = input.files.map(
    ({ blob, filename }) => new File([blob], filename, { type: blob.type }),
  );
  let canShareFiles = false;
  if (typeof navigator.share === "function") {
    try {
      canShareFiles =
        typeof navigator.canShare !== "function" || navigator.canShare({ files });
    } catch {
      canShareFiles = false;
    }
  }

  if (canShareFiles) {
    try {
      await navigator.share({ title: input.title, text: input.text, files });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  for (const file of input.files) downloadBlob(file.blob, file.filename);
  const chatUrl = `https://wa.me/${whatsappNumber(input.phone)}?text=${encodeURIComponent(input.text)}`;
  window.open(chatUrl, "_blank", "noopener,noreferrer");
  return "fallback";
}
