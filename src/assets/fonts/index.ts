// Vite embeds these checked-in Unicode TTFs into the application as data URLs.
// PDF creation needs no fetch(), CDN, Google Fonts, or font-service connection.
import regular from "./NotoSansBengali-Regular.ttf?inline";
import bold from "./NotoSansBengali-Bold.ttf?inline";

export const bengaliFonts = {
  Regular: { filename: "NotoSansBengali-Regular.ttf", dataUrl: regular },
  Bold: { filename: "NotoSansBengali-Bold.ttf", dataUrl: bold },
} as const;

export function embeddedFontBase64(dataUrl: string): string {
  const marker = ";base64,";
  const index = dataUrl.indexOf(marker);
  if (!dataUrl.startsWith("data:") || index < 0) {
    throw new Error("Bundled Bengali font is missing");
  }
  return dataUrl.slice(index + marker.length);
}
