# ShopLedGer - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 18 September 2026  
**Status:** Approved for Development

---

## 1. App Overview

**Name:** ShopLedGer (changeable later from settings)  
**Type:** Progressive Web App (PWA)  
**Purpose:** Complete offline-first shop accounting system for mobile, supporting multi-user roles, multi-branch operations, customer ordering, WhatsApp receipts, and PDF reports.

Primarily designed for Bangladeshi shops (animal feed, grocery, retail etc.).

---

## 2. User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Owner** | Full access. Create/edit/delete branches, manage users, all reports, settings, product master, backup management |
| **Staff** | Sales entry, Purchase entry, Collection (due recovery), Expenses, View stock, View daily/monthly reports, View customer dues. Cannot manage branches or users |
| **Customer** | View own dues, View collection history, Place orders, Track order status, View current product prices |

---

## 3. Main Modules / Screens

1. Login / Registration
2. Dashboard (role-based)
3. Sales Entry
4. Purchase Entry
5. Due Collection (বাকি আদায়)
6. Expenses
7. Stock
8. Product List
9. Customer Dues
10. Order Management (Customer places → Staff/Owner accepts)
11. Daily Profit
12. Monthly Profit
13. Branch Management (Owner only)
14. User Management (Owner only)
15. Report Center (Preview + PDF Download)
16. Settings (App name, logo, theme, backup)

---

## 4. Detailed Features

### 4.1 Offline & Sync
- All entries are first saved in device local storage (IndexedDB via Dexie.js).
- When internet is available, data auto-syncs with Supabase.
- Conflict resolution: Last-write-wins or Owner can manually resolve.

### 4.2 Daily Auto Backup
- Automatic backup every day at 11:59 PM (configurable).
- Backup stored in Supabase Storage / Google Drive.
- Owner can trigger manual backup and restore.

### 4.3 Multi Branch
- Owner can create unlimited branches.
- Each branch has separate stock, sales, expenses and customers.
- Owner can view consolidated dashboard across all branches.

### 4.4 Customer Order System
- Customers can select products and place orders from the app.
- Order Status flow: `Pending` → `Accepted` → `Delivered` / `Cancelled`
- Staff/Owner can accept order and convert it into a sales entry.

### 4.5 WhatsApp Receipt
- After every sale, a beautiful receipt image can be sent via WhatsApp.
- Receipt contains: Shop name, Branch, Date, Items (name, qty, rate, amount), Total, Payment type.
- Generated as image using html2canvas.

### 4.6 PDF Reports
- Every report screen has a "Download PDF" button at the bottom.
- PDF includes shop name, branch, date range and relevant data.

### 4.7 Report Center — 10 Reports (v1.1, implemented)

Workflow for every report: **Select Filters → Generate Report → Preview → Download PDF**.
Each report generates its **own separate PDF** (no combined PDF by default).

| Report | Filters | Columns / output |
|--------|---------|------------------|
| Sales | Date from/to, Product, Customer, Cash/Due | Date, Product, Customer, Type, Quantity, Rate, Sales Amount + Total Sales |
| Purchase | Date from/to, Product, Supplier | Date, Product, Supplier, Quantity, Purchase Rate, Purchase Amount + Total Purchase |
| Stock | Date from/to (optional), Product, Category | Product, Opening Stock, Total Purchase, Total Sales, Current Stock, Purchase Value, Sale Value |
| Customer Due | Date (optional), Customer | Customer, Total Due Sales, Total Collection, Current Due (customer-wise balance) |
| Due Collection | Date from/to, Customer, Payment Method | Date, Customer, Payment Method, Collection Amount + Total Collection |
| Expense | Date from/to, Category, Kind (shop/owner) | Date, Category, Description, Amount + Total Expense |
| Daily Profit | Select Date | Total Sales, COGS, Gross Profit, Total Expense, Net Profit, Cash Sales, Due Sales, Due Collection |
| Monthly Profit | Select Month | Total Sales, Total Purchase, COGS, Gross Profit, Total Expense, Net Profit, Due Sales, Due Collection, Closing Due, Stock Value |
| Product | Category, Search | Product, Purchase Price, Sale Price, Opening Stock, Current Stock |
| Transaction | Date from/to, Type, Search | Date, Transaction Type, Product, Customer/Supplier, Quantity, Amount, Payment Status |

**PDF format:** professional A4 portrait — header (business name, report name, selected period),
clean table with right/left column alignment, automatic totals row and summary, footer with
generated date/time and page number (`Page X / Y`). No unnecessary columns.

**Access:** owner sees all branches (with a branch filter); staff sees only their own branch;
customer role has no access.

---

## 5. High-Level Database Schema

**Core Tables:**

- `branches`
- `users` (role: owner / staff / customer)
- `products`
- `purchases`
- `sales`
- `sale_items`
- `collections` (due recovery)
- `expenses`
- `customers`
- `orders`
- `order_items`
- `stock_movements` (optional audit)
- `backups`

All transactional tables include `branch_id`.

---

## 6. Non-Functional Requirements

- Full Bangla user interface
- Mobile-first design (large buttons, easy navigation)
- Fast loading with PWA caching
- Role-based access control (Row Level Security in Supabase)
- App name, logo and primary color changeable from Settings

---

## 7. Recommended Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React + Vite + Tailwind CSS       |
| Offline     | Dexie.js (IndexedDB)              |
| Backend     | Supabase (Auth + Database + Storage + Realtime) |
| PWA         | vite-plugin-pwa                   |
| PDF         | jsPDF + html2canvas               |
| WhatsApp    | html2canvas → Share via wa.me     |

---

## 8. Future Enhancements (Out of Scope for v1.0)

- Barcode / QR scanning
- SMS notification
- Multi-currency
- Advanced analytics & charts
- Supplier management portal

---

**Document Owner:** Project Initiator  
**Last Updated:** 18 September 2026
