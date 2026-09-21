# Daily notes — ShopLedGer

## 2026-09-21

Checked `main` after 20 Sep top-bar/weather work and remaining 19 Sep audit items.

### Shipped today
- Profit-loss period header uses `bnDate` (Bangla month + digits) instead of ISO `YYYY-MM-DD` (finding #7).
- Transaction report adds a `সর্বমোট` footer row on screen and in PDF (finding #5).

### Next (still open from audit)
- #4 Shop order list branch filter.
- #6 SaleReceipt Escape / focus trap / scroll lock.
- #13 First-login dialog `role="dialog"` (if that modal still exists on this stack).
- #1 Signup phone OTP / existing-customer check.
