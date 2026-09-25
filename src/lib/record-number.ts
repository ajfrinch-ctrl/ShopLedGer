/** Human-readable references within one shop ledger; never renumber historical rows. */
export const RECORD_PREFIX = {
  bill: "B",
  customer: "C",
  order: "O",
  product: "P",
  purchase: "PU",
  collection: "CL",
  expense: "E",
  adjustment: "SA",
  registration: "R",
  staff: "ST",
  admin: "AD",
} as const;

export type NumberSequences = Record<string, number>;

export function nextRecordNumber(
  prefix: (typeof RECORD_PREFIX)[keyof typeof RECORD_PREFIX],
  date: string,
  sequences: NumberSequences,
  existingNumbers: Iterable<string>,
): { number: string; sequences: NumberSequences } {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Invalid record date");
  }
  const key = `${prefix}-${date.slice(2).replaceAll("-", "")}`;
  let last = sequences[key] ?? 0;
  if (!Number.isSafeInteger(last) || last < 0) throw new Error("Invalid number sequence");
  // Supports legacy stores without counters and imported records with higher numbers.
  for (const value of existingNumbers) {
    if (!value.startsWith(key)) continue;
    const suffix = value.slice(key.length);
    if (!/^\d{3,}$/.test(suffix)) continue;
    const seq = Number(suffix);
    if (!Number.isSafeInteger(seq)) throw new Error("Invalid record number");
    last = Math.max(last, seq);
  }
  const next = last + 1;
  if (!Number.isSafeInteger(next)) throw new Error("Number sequence exhausted");
  return {
    number: `${key}${String(next).padStart(3, "0")}`,
    sequences: { ...sequences, [key]: next },
  };
}
