import type {
  Content,
  ContentCanvas,
  ContentText,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { PdfDocument } from "./pdf.ts";
import type { MeasureText } from "./pdf-layout.ts";
import { PDF_TYPE, fitCell } from "./pdf-layout.ts";
import { normalizePdfText } from "./unicode.ts";
import { STATEMENT_FOOTER } from "./document-text.ts";
import { bnNum } from "../format.ts";

export const RECEIPT_PAGE = {
  width: 595.28,
  height: 419.53,
  margin: (8 * 72) / 25.4,
  bottom: 44,
} as const;
export const RECEIPT_COLORS = {
  brand: "#15543b",
  header: "#dfeae2",
  summary: "#eff5f0",
  title: "#e5e5e5",
  due: "#b33030",
  ink: "#000000",
  paper: "#ffffff",
} as const;
interface ReceiptBrand {
  name: string;
  tagline: string;
  address: string;
  phones: readonly string[];
}

/** A5 landscape cash memo based on the supplied receipt reference. */
export function a5ReceiptDefinition(
  document: PdfDocument,
  brand: ReceiptBrand,
  logo: string,
  measure: MeasureText,
): TDocumentDefinitions {
  const width = RECEIPT_PAGE.width - 2 * RECEIPT_PAGE.margin;
  const text = (
    value: string,
    style: Omit<ContentText, "text"> & { width?: number | "*" } = {},
  ): ContentText => ({
    text: normalizePdfText(value),
    ...style,
  });
  const nameWidth = Math.min(measure(brand.name, PDF_TYPE.heading, true), width - 40);
  const indent = (width - nameWidth - 40) / 2;
  const rule: Content = {
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: width,
        y2: 0,
        lineColor: RECEIPT_COLORS.brand,
        lineWidth: 0.8,
      },
    ],
    margin: [0, 4, 0, 5],
  };
  const content: Content[] = [
    {
      columns: [
        { image: "shopLogo", fit: [32, 32], width: 32 },
        text(brand.name, {
          width: nameWidth,
          fontSize: PDF_TYPE.heading,
          bold: true,
          color: RECEIPT_COLORS.brand,
          alignment: "center",
          margin: [0, 5, 0, 0],
        }),
      ],
      columnGap: 8,
      margin: [indent, 0, indent, 0],
    },
    text(brand.tagline, { alignment: "center", fontSize: PDF_TYPE.caption }),
    text(brand.address, { alignment: "center", fontSize: PDF_TYPE.caption }),
    text(`মোবাইল: ${brand.phones.join(" - ")}`, {
      alignment: "center",
      fontSize: PDF_TYPE.caption,
    }),
    rule,
    {
      table: {
        widths: ["*"],
        body: [
          [
            text("বিক্রয় রসিদ (Sales Receipt)", {
              bold: true,
              alignment: "center",
              fillColor: RECEIPT_COLORS.title,
            }),
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 4],
    },
  ];
  const info = document.receiptInfo;
  if (info) {
    // Mobile and address always sit directly under the customer name, in
    // every receipt where the values exist.
    const customerLines: ContentText[] = [text(`ক্রেতা: ${info.customerName}`)];
    if (info.customerPhone?.trim()) customerLines.push(text(`মোবাইল: ${info.customerPhone.trim()}`));
    if (info.customerAddress?.trim())
      customerLines.push(text(`ঠিকানা: ${info.customerAddress.trim()}`));
    content.push({
      columns: [
        { width: "*", stack: customerLines, fontSize: PDF_TYPE.caption },
        {
          width: "*",
          stack: [text(`বিল নম্বর: ${info.billNo}`), text(`তারিখ: ${info.date}`)],
          alignment: "right",
          fontSize: PDF_TYPE.caption,
        },
      ],
      columnGap: 8,
      margin: [0, 0, 0, 5],
    });
  } else content.push(text(document.subtitle, { margin: [0, 0, 0, 5] }));

  const border = 0.5;
  const padding = 4;
  const available = width - 5 * border - 8 * padding;
  const widths = [0.4, 0.22, 0.18, 0.2].map((ratio) => available * ratio);
  const items = document.sections[0]?.rows ?? [];
  const itemBody: TableCell[][] = [
    ["পণ্যের বিবরণ", "পরিমাণ", "দর (টাকা)", "মোট (টাকা)"].map((label) =>
      text(label, { bold: true, alignment: "center", fillColor: RECEIPT_COLORS.header }),
    ),
  ];
  for (const [rowIndex, row] of items.entries()) {
    itemBody.push(
      row.map((value, column) => ({
        ...text(column === 0 ? `${bnNum(rowIndex + 1)}. ${value}` : value),
        alignment: column === 0 ? "left" : column === 1 ? "center" : "right",
        ...fitCell(value, column >= 2 ? "money" : "text", widths[column], measure),
      })),
    );
  }
  if (!items.length) itemBody.push([{ ...text("কোনো পণ্য নেই"), colSpan: 4 }, {}, {}, {}]);
  const grid = {
    vLineWidth: () => border,
    hLineWidth: () => border,
    vLineColor: () => RECEIPT_COLORS.ink,
    hLineColor: () => RECEIPT_COLORS.ink,
    paddingLeft: () => padding,
    paddingRight: () => padding,
    paddingTop: () => 2,
    paddingBottom: () => 2,
  };
  content.push({
    table: { widths, headerRows: 1, keepWithHeaderRows: 0, dontBreakRows: false, body: itemBody },
    layout: grid,
  });
  const summary = document.sections[1];
  if (summary?.rows.length) {
    const amountWidth = widths[3];
    const labelWidth = width - amountWidth - 3 * border - 4 * padding;
    content.push({
      table: {
        widths: [labelWidth, amountWidth],
        dontBreakRows: false,
        body: summary.rows.map((row, index) => {
          const bold = summary.emphasisRows?.includes(index) ?? false;
          const due = index === 4;
          return row.map((value, column) => ({
            ...text(column === 0 ? `${value}${due ? " (Due)" : ""}:` : value),
            alignment: "right",
            border:
              column === 0
                ? [true, false, true, index === summary.rows.length - 1]
                : [true, true, true, true],
            bold,
            color: due ? RECEIPT_COLORS.due : RECEIPT_COLORS.ink,
            fillColor: RECEIPT_COLORS.summary,
            ...fitCell(
              value,
              column === 0 ? "text" : "money",
              column === 0 ? labelWidth : amountWidth,
              (v, size) => measure(v, size, bold),
            ),
          }));
        }),
      },
      layout: { ...grid, hLineWidth: (index) => (index === 0 ? 0 : border) },
    });
  }
  if (document.note)
    content.push(
      text(`নোট: ${document.note}`, { fontSize: PDF_TYPE.caption, margin: [0, 5, 0, 0] }),
    );
  content.push(
    text("আমাদের সাথে থাকার জন্য ধন্যবাদ।", {
      alignment: "center",
      fontSize: PDF_TYPE.caption,
      margin: [0, 5, 0, 0],
    }),
  );
  // As in the A4 renderer, layout metadata anchors the last-page footer after
  // the actual content. Do not invent weights, return policies or attribution.
  const endMarker: ContentCanvas & { positions?: { pageNumber: number; top: number }[] } = {
    canvas: [
      { type: "line", x1: 0, x2: 0, y1: 0, y2: 0, lineWidth: 0, lineColor: RECEIPT_COLORS.paper },
    ],
  };
  content.push(endMarker);
  return {
    info: { title: normalizePdfText(document.title), author: normalizePdfText(brand.name) },
    pageSize: "A5",
    pageOrientation: "landscape",
    pageMargins: [RECEIPT_PAGE.margin, 40, RECEIPT_PAGE.margin, RECEIPT_PAGE.bottom],
    images: { shopLogo: logo },
    defaultStyle: { font: "Bengali", fontSize: PDF_TYPE.body, color: RECEIPT_COLORS.ink },
    content,
    header: (page) =>
      page === 1
        ? { text: "" }
        : {
            columns: [
              { image: "shopLogo", fit: [18, 18], width: 18 },
              text(brand.name, { bold: true, color: RECEIPT_COLORS.brand, alignment: "center" }),
              { text: "", width: 18 },
            ],
            fontSize: PDF_TYPE.caption,
            columnGap: 6,
            margin: [RECEIPT_PAGE.margin, 14, RECEIPT_PAGE.margin, 0],
          },
    footer: (page, count, pageSize) => {
      const end = endMarker.positions?.find((position) => position.pageNumber === page);
      return {
        stack: [
          text(STATEMENT_FOOTER),
          text(`পৃষ্ঠা ${bnNum(page)} / ${bnNum(count)}`, { margin: [0, 3, 0, 0] }),
        ],
        fontSize: PDF_TYPE.caption,
        alignment: "center",
        margin: [RECEIPT_PAGE.margin, 7, RECEIPT_PAGE.margin, 0],
        ...(end
          ? {
              relativePosition: { x: 0, y: end.top + 10 - (pageSize.height - RECEIPT_PAGE.bottom) },
            }
          : {}),
      };
    },
  };
}
