import type { Content, ContentCanvas, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { PdfDocument } from "./pdf.ts";
import { bnNum } from "../format.ts";
import { normalizePdfText } from "./unicode.ts";
import { STATEMENT_FOOTER } from "./document-text.ts";
import { PDF_PAGE, PDF_TYPE, planTables, fitCell, centeredTableHeaders } from "./pdf-layout.ts";
import type { MeasureText } from "./pdf-layout.ts";

export const REPORT_COLORS = {
  header: "#203864",
  stripe: "#e8eff7",
  ink: "#000000",
  paper: "#ffffff",
} as const;
interface ReportBrand {
  name: string;
  tagline: string;
  address: string;
  phones: readonly string[];
}

export function reportDefinition(
  document: PdfDocument,
  brand: ReportBrand,
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
  const ink = REPORT_COLORS.ink;
  const content: Content[] = [
    {
      stack: [
        { text: normalizePdfText(brand.name), fontSize: PDF_TYPE.heading, bold: true },
        { text: normalizePdfText(brand.tagline), fontSize: PDF_TYPE.caption, margin: [0, 0, 0, 0] },
        { text: normalizePdfText(brand.address), fontSize: PDF_TYPE.caption, margin: [0, 0, 0, 0] },
        { text: brand.phones.join(" - "), fontSize: PDF_TYPE.caption, margin: [0, 0, 0, 0] },
      ],
      alignment: "center",
      margin: [0, 0, 0, 0],
    },
    {
      text: document.title,
      fontSize: PDF_TYPE.heading,
      bold: true,
      alignment: "center",
      margin: [0, 2, 0, 0],
    },
    {
      text: document.subtitle,
      fontSize: PDF_TYPE.caption,
      alignment: "center",
      margin: [0, 0, 0, 4],
    },
  ];
  for (const [sectionIndex, section] of document.sections.entries()) {
    const tablePlan = plan.tables[sectionIndex];
    if (section.title) content.push({ text: section.title, bold: true, margin: [0, 2, 0, 0] });
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
          centeredTableHeaders(section.headers).map((cell) => ({
            ...cell,
            color: REPORT_COLORS.paper,
            fillColor: REPORT_COLORS.header,
          })),
          ...section.rows.map((row, rowIndex) =>
            row.map<TableCell>((text, index) => ({
              text,
              bold: section.emphasisRows?.includes(rowIndex) ?? false,
              alignment: ["id", "quantity"].includes(section.columns[index].kind)
                ? "center"
                : tablePlan.alignments[index],
              ...fitCell(
                text,
                section.columns[index].kind,
                tablePlan.widths[index],
                (value, size) => measure(value, size, section.emphasisRows?.includes(rowIndex)),
              ),
              margin: [0, 0, 0, 0],
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
        paddingTop: () => 2,
        paddingBottom: () => 2,
        fillColor: (row) =>
          row === 0
            ? REPORT_COLORS.header
            : row % 2 === 0
              ? REPORT_COLORS.stripe
              : REPORT_COLORS.paper,
      },
      margin: [0, 0, 0, 0],
    });
  }
  if (document.note)
    content.push({ text: [{ text: "নোট: ", bold: true }, document.note], margin: [0, 6, 0, 6] });
  // pdfmake 0.3 lays out body nodes before evaluating footers. Its measured
  // positions let the final footer follow the actual table/note, not an
  // estimate based on row count. This zero-height marker prints nothing.
  const endMarker: ContentCanvas & { positions?: { pageNumber: number; top: number }[] } = {
    canvas: [
      { type: "line", x1: 0, y1: 0, x2: 0, y2: 0, lineWidth: 0, lineColor: REPORT_COLORS.paper },
    ],
  };
  content.push(endMarker);
  return {
    info: { title: document.title, author: normalizePdfText(brand.name) },
    pageSize: "A4",
    pageOrientation: plan.orientation,
    pageMargins: [PDF_PAGE.margin, PDF_PAGE.margin, PDF_PAGE.margin, 56],
    header: (page) =>
      page === 1
        ? { text: "" }
        : {
            stack: [
              { text: normalizePdfText(brand.name), fontSize: PDF_TYPE.caption, bold: true },
              { text: document.title, fontSize: PDF_TYPE.caption },
            ],
            alignment: "center",
            margin: [PDF_PAGE.margin, 12, PDF_PAGE.margin, 0],
          },
    defaultStyle: { font: "Bengali", fontSize: PDF_TYPE.body, color: ink },
    content,
    footer: (page, count, pageSize) => {
      const end = endMarker.positions?.find((position) => position.pageNumber === page);
      return {
        stack: [
          { text: normalizePdfText(STATEMENT_FOOTER), fontSize: PDF_TYPE.caption },
          {
            text: `পৃষ্ঠা ${bnNum(page)} / ${bnNum(count)}`,
            fontSize: PDF_TYPE.caption,
            margin: [0, 3, 0, 0],
          },
        ],
        alignment: "center",
        // Final page: just below the table. Earlier pages: reserved footer area.
        margin: [PDF_PAGE.margin, 8, PDF_PAGE.margin, 0],
        ...(end ? { relativePosition: { x: 0, y: end.top + 10 - (pageSize.height - 56) } } : {}),
      };
    },
  };
}
