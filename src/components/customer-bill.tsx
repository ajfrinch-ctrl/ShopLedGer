import { bnDate, bnNum, money } from "@/lib/format";
import type { Sale } from "@/lib/types";

/** A bill opens its own saved sale, never a customer's aggregate balance. */
export function CustomerBill({ sale, onOpen }: { sale: Sale; onOpen: (sale: Sale) => void }) {
  return (
    <button
      type="button"
      aria-label={`${sale.billNo} — রসিদ দেখুন`}
      onClick={() => onOpen(sale)}
      className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-mint focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="min-w-0">
        <p className="text-body font-bold">{sale.billNo}</p>
        <p className="text-caption text-muted">
          {bnDate(sale.date)} • {bnNum(sale.items.length)}টি পণ্য
        </p>
        <p className="mt-1 text-caption font-bold text-primary">রসিদ দেখুন →</p>
      </div>
      <p className="shrink-0 text-body font-bold tabular">{money(sale.total)}</p>
    </button>
  );
}
