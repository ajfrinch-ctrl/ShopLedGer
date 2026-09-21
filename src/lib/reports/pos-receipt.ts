import type { Content, ContentText, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { PdfDocument } from "./pdf.ts";
import { PDF_TYPE, centeredTableHeaders } from "./pdf-layout.ts";
import { normalizePdfText } from "./unicode.ts";
import { STATEMENT_FOOTER } from "./document-text.ts";

// 80mm roll, with 4mm margins: 72mm printable width on common POS printers.
export const POS_PAGE = { width: (80 * 72) / 25.4, margin: (4 * 72) / 25.4 } as const;

interface ReceiptBrand {
  name: string;
  tagline: string;
  address: string;
  phones: readonly string[];
}

/** A continuous thermal roll, not an A4 table shrunk to illegible text. */
export function posReceiptDefinition(
  document: PdfDocument,
  brand: ReceiptBrand,
  logo: string,
): TDocumentDefinitions {
  const width = POS_PAGE.width - 2 * POS_PAGE.margin;
  const text = (value: string, style: Omit<ContentText, "text"> = {}): ContentText => ({
    text: normalizePdfText(value),
    ...style,
  });
  const rule = (): Content => ({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: width,
        y2: 0,
        lineWidth: 0.5,
        lineColor: "#000000",
        dash: { length: 2, space: 2 },
      },
    ],
    margin: [0, 6, 0, 6],
  });
  const content: Content[] = [
    {
      stack: [
        { image: "shopLogo", fit: [32, 32], alignment: "center", margin: [0, 0, 0, 4] },
        text(brand.name, { fontSize: PDF_TYPE.heading, bold: true }),
        text(brand.tagline, { fontSize: PDF_TYPE.caption }),
        text(brand.address, { fontSize: PDF_TYPE.caption, margin: [0, 2, 0, 2] }),
        text(brand.phones.join(" • "), { fontSize: PDF_TYPE.caption }),
        text(document.title, { bold: true, margin: [0, 6, 0, 0] }),
      ],
      alignment: "center",
    },
    rule(),
  ];
  if (document.receiptInfo) {
    const info = document.receiptInfo;
    content.push(
      text(`বিল: ${info.billNo}`),
      text(`তারিখ: ${info.date}`, { fontSize: PDF_TYPE.caption }),
      text(`ক্রেতা: ${info.customerName}`, { margin: [0, 2, 0, 0] }),
    );
    // Mobile and address always sit directly under the customer name.
    if (info.customerPhone?.trim())
      content.push(text(`মোবাইল: ${info.customerPhone.trim()}`, { fontSize: PDF_TYPE.caption }));
    if (info.customerAddress?.trim())
      content.push(text(`ঠিকানা: ${info.customerAddress.trim()}`, { fontSize: PDF_TYPE.caption }));
  } else {
    content.push(text(document.subtitle, { fontSize: PDF_TYPE.caption }));
  }
  content.push(rule());
  for (const [index, section] of document.sections.entries()) {
    if (section.title) content.push(text(section.title, { bold: true }));
    if (!section.rows.length) {
      content.push(text("এই সময়ে কোনো ডাটা নেই"));
      continue;
    }
    const items = index === 0;
    const body: TableCell[][] = [
      centeredTableHeaders(
        items ? ["পণ্য / পরিমাণ × দর", "মোট"] : section.headers.map(normalizePdfText),
      ),
    ];
    for (const [rowIndex, row] of section.rows.entries()) {
      if (items) {
        // The product name gets the whole roll width; never squeeze four
        // A4 columns onto thermal paper or omit the saved unit price.
        body.push(
          [{ ...text(row[0]), colSpan: 2 }, {}],
          [
            text(`${row[1]} × ${row[2]}`, { fontSize: PDF_TYPE.caption }),
            text(row[3], { alignment: "right" }),
          ],
        );
      } else {
        const bold = section.emphasisRows?.includes(rowIndex) ?? false;
        body.push([text(row[0], { bold }), text(row[1], { bold, alignment: "right" })]);
      }
    }
    content.push({
      table: {
        widths: [width * 0.58 - 6, width * 0.42 - 6],
        body,
        dontBreakRows: false,
        headerRows: 1,
      },
      layout: {
        vLineWidth: () => 0,
        hLineWidth: (line) => (line === 1 || (items && line > 1 && line % 2 === 1) ? 0.5 : 0),
        hLineColor: () => "#000000",
        hLineStyle: () => ({ dash: { length: 2, space: 2 } }),
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 0, 0, 6],
    });
  }
  if (document.note)
    content.push(
      text(`নোট: ${document.note}`, { fontSize: PDF_TYPE.caption, margin: [0, 4, 0, 0] }),
    );
  // With auto-height, put the footer in the content flow so it follows the
  // final item/total and the paper ends immediately after the notice.
  content.push(rule(), text(STATEMENT_FOOTER, { alignment: "center", fontSize: PDF_TYPE.caption }));
  return {
    info: { title: normalizePdfText(document.title), author: normalizePdfText(brand.name) },
    images: { shopLogo: logo },
    pageSize: { width: POS_PAGE.width, height: "auto" },
    pageMargins: [POS_PAGE.margin, POS_PAGE.margin, POS_PAGE.margin, POS_PAGE.margin],
    defaultStyle: { font: "Bengali", fontSize: PDF_TYPE.body, color: "#000000" },
    content,
  };
}
