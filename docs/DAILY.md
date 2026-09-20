# Daily notes — ShopLedGer

## 2026-09-20

Checked `main` (ShopLedGer PWA) and the 19 Sep 2026 final audit findings.

### Shipped today
- MyDues Bangla labels + in-page customer role guard (findings #9, #2).
- Salesmen list Bangla counts; inactive vs lock-out labels (findings #8, #10).
- BranchPads: auto-select first active branch on open so the pad form is not blank and staff count is not `(0)` (finding #11). "New branch" still starts an empty draft. Chip staff counts now use `staffBranchIds`.

### Next (still open from audit)
- #3 Backup page in-page role guard (auto snapshot on render).
- #4 Shop order list branch filter.
- #5 Transaction report grand-total row.
- #6 SaleReceipt Escape / focus trap / scroll lock.
- #7 ProfitLoss period header Bangla digits.
- #13 First-login dialog `role="dialog"`.
