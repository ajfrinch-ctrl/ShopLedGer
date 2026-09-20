export type PdfColumnKind = "text" | "date" | "money" | "quantity" | "phone" | "id";
export interface PdfColumn {
  kind: PdfColumnKind;
  /** Minimum content width, in points, excluding cell padding. */
  minWidth?: number;
  weight?: number;
}
export interface PdfSection {
  title?: string;
  headers: string[];
  columns: PdfColumn[];
  rows: string[][];
  /** Zero-based rows emphasized with bold text/rules, never shaded fills. */
  emphasisRows?: number[];
}

// A4 (210 × 297mm); 15mm side margins are safe for ordinary office printers.
export const PDF_PAGE = {
  portrait: 595.28,
  landscape: 841.89,
  margin: 42.52,
  padding: 6,
  border: 0.5,
} as const;
const tableOverhead = (columns: number) =>
  columns * 2 * PDF_PAGE.padding + (columns + 1) * PDF_PAGE.border;
export const PDF_TYPE = { heading: 13.5, body: 10.5, caption: 9 } as const;
export type MeasureText = (text: string, size: number, bold?: boolean) => number;

export function columnAlignment(kind: PdfColumnKind): "left" | "right" | "center" {
  if (kind === "money" || kind === "quantity") return "right";
  if (kind === "date" || kind === "phone") return "center";
  return "left";
}

/** Headers are always centered, independently of the data-column alignment. */
export function centeredTableHeaders(headers: string[]) {
  return headers.map((text) => ({
    text,
    bold: true,
    alignment: "center" as const,
    margin: [0, 2, 0, 2] as [number, number, number, number],
  }));
}

const minimum: Record<PdfColumnKind, number> = {
  text: 100,
  date: 76,
  money: 78,
  quantity: 72,
  phone: 88,
  id: 58,
};
const keepTogether = (kind: PdfColumnKind) =>
  kind === "date" || kind === "money" || kind === "phone";

function requiredWidths(section: PdfSection, measure: MeasureText): number[] {
  if (
    section.headers.length !== section.columns.length ||
    section.rows.some((row) => row.length !== section.columns.length)
  ) {
    throw new Error("PDF table columns do not match the data");
  }
  return section.columns.map((column, index) =>
    Math.max(
      column.minWidth ?? minimum[column.kind],
      keepTogether(column.kind)
        ? section.rows.reduce(
            (width, row, rowIndex) =>
              Math.max(
                width,
                measure(row[index], PDF_TYPE.body, section.emphasisRows?.includes(rowIndex)) + 2,
              ),
            0,
          )
        : 0,
    ),
  );
}

export function planTables(sections: PdfSection[], measure: MeasureText) {
  const minimums = sections.map((section) => requiredWidths(section, measure));
  const needed = (widths: number[]) =>
    widths.reduce((a, b) => a + b, 0) + tableOverhead(widths.length);
  const orientation = minimums.some(
    (widths) => needed(widths) > PDF_PAGE.portrait - 2 * PDF_PAGE.margin,
  )
    ? ("landscape" as const)
    : ("portrait" as const);
  const contentWidth = PDF_PAGE[orientation] - 2 * PDF_PAGE.margin;
  const tables = sections.map((section, sectionIndex) => {
    const reserved = minimums[sectionIndex];
    const available = contentWidth - tableOverhead(section.columns.length);
    const total = reserved.reduce((a, b) => a + b, 0);
    const weights = section.columns.map(
      (column) => column.weight ?? (column.kind === "text" ? 3 : 1),
    );
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const widths = reserved.map((width, index) =>
      total > available
        ? (width * available) / total
        : width + ((available - total) * weights[index]) / weightSum,
    );
    // Ordinary rows move intact to the next page. Exceptionally tall rows are
    // allowed to continue rather than being dropped by an unbreakable table.
    const safeRowHeight = (orientation === "portrait" ? 841.89 : 595.28) - 180;
    const dontBreakRows = section.rows.every((row) =>
      row.every((text, index) => {
        const lines = text
          .split("\n")
          .reduce(
            (sum, line) =>
              sum + Math.max(1, Math.ceil(measure(line, PDF_TYPE.body) / widths[index])),
            0,
          );
        return (lines * 2 + 1) * PDF_TYPE.body + 12 < safeRowHeight;
      }),
    );
    return {
      widths,
      dontBreakRows,
      alignments: section.columns.map((column) => columnAlignment(column.kind)),
    };
  });
  return { orientation, contentWidth, tables };
}

/** Never truncate values or force text beyond a fixed-width cell. */
export function fitCell(text: string, kind: PdfColumnKind, width: number, measure: MeasureText) {
  if (!keepTogether(kind)) return { fontSize: PDF_TYPE.body, noWrap: false };
  const measured = measure(text, PDF_TYPE.body);
  const fontSize =
    measured > width
      ? Math.max(PDF_TYPE.caption, (PDF_TYPE.body * (width - 1)) / measured)
      : PDF_TYPE.body;
  return { fontSize, noWrap: measure(text, fontSize) <= width };
}
