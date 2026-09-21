# Record numbers and customer mobile identity

New records use `<prefix>-<YYMMDD><sequence>`, for example `B-260912001`.
The sequence starts at `001` for each prefix/date and grows past `999` without
truncation. Dates use the Bangladesh calendar (`Asia/Dhaka`) for today's date.

| Record                        | Prefix | Date used        |
| ----------------------------- | ------ | ---------------- |
| Bill / sale                   | B      | Sale date        |
| Customer                      | C      | Creation date    |
| Order                         | O      | Creation date    |
| Product / product code        | P      | Creation date    |
| Purchase                      | PU     | Purchase date    |
| Collection / supplier payment | CL     | Transaction date |
| Expense / owner withdrawal    | E      | Expense date     |
| Stock adjustment              | SA     | Adjustment date  |
| Customer registration request | R      | Submission date  |

- IDs and bill numbers are assigned when saving, not while a form is open.
- Each issued counter is persisted in `numberSequences` in the existing
  `karnaphuli-shopledger-v1` store. Reservations remain after deleting records
  or resetting demo data; gaps are intentional, numbers are never recycled.
- Existing matching references are considered when allocating, so missing or
  older counters do not collide with records already present in that ledger.
- Older records retain their original IDs, bill numbers and product codes.
  Customer links, demo logins, existing receipts and foreign keys are unchanged.
- Editing a transaction date does not change an already-issued number.
- New product codes equal their generated product IDs; neither is editable.
- A sale created by fulfilling an order receives a bill number in the same
  series as directly entered sales. The note retains the complete order ID.

## Storage scope (important)

The current application is a **browser-local ledger**, not a shared server
ledger. The counters follow the same storage scope. Use one active editing tab
for a ledger. Separate browsers/devices or simultaneous independent tabs do
not have a shared atomic number allocator. Clearing site data, restoring an old
backup, or combining independently created ledgers cannot preserve a global
sequence. Do not describe these as globally unique across devices. Supporting
concurrent shop-wide writes requires a central transactional allocator and
unique database constraints (or a redesigned offline namespace/sync protocol),
not merely a date prefix. None of those server/sync facilities are introduced
by this change.

## Customer mobile numbers

- The original `Customer.phone` is required for new customers, normalized to
  `01XXXXXXXXX`, unique within the ledger, and immutable after saving.
- Bengali digits and `+880` variants normalize to the same identity. Validation
  runs inside store actions, including the quick-create customer flow in sales.
- Customer and registration editing cannot change the original phone, including
  runtime/admin payloads. Existing customer IDs and transaction relationships
  are preserved; WhatsApp numbers are never used to resolve login identities.
- `Customer.whatsappPhone` is optional and can be added, changed or cleared on
  the customer profile. It currently accepts Bangladesh mobile numbers, like
  the original phone field. Clearing it restores the original phone as the
  WhatsApp destination.
- Receipt PDF/image sharing, statement PDF/image sharing and the direct chat
  link prefer `whatsappPhone || phone`. `wa.me` uses `8801XXXXXXXXX`.
- Old customer records without `whatsappPhone` need no migration.

## Verification

`npm test` covers allocator boundaries, persistence/deletion, legacy IDs,
creation and fulfillment paths, immutable admin edits, duplicate mobiles,
registration approval/login and WhatsApp normalization. `npm run build:pages &&
npm run test:pages` additionally exercises the customer UI and WhatsApp links
against the static GitHub Pages deployment.
