import { whatsappNumber } from "@/lib/format";
import type { PdfDocument } from "./pdf";
import { createPdfBlob, downloadBlob } from "./pdf";

export type PdfShareResult = "shared" | "cancelled" | "fallback";

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
  const file = new File([blob], input.document.filename, { type: "application/pdf" });
  let canShareFiles = false;
  if (typeof navigator.share === "function") {
    try {
      canShareFiles =
        typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
    } catch {
      canShareFiles = false;
    }
  }

  if (canShareFiles) {
    try {
      await navigator.share({
        title: input.document.title,
        text: input.text,
        files: [file],
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  downloadBlob(blob, input.document.filename);
  const chatUrl = `https://wa.me/${whatsappNumber(input.phone)}?text=${encodeURIComponent(input.text)}`;
  window.open(chatUrl, "_blank", "noopener,noreferrer");
  return "fallback";
}
