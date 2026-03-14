# 💰 Simple Accounting

A free, open-source, **fully client-side accounting web app** — no server, no backend, no sign-up required. Runs entirely in your browser and stores data locally using `localStorage`.

🌐 **Live App:** [andy-and-terry.github.io/accounting-software](https://andy-and-terry.github.io/accounting-software)

> ⚠️ **Data is stored only in this browser.** Use the built-in JSON backup regularly to avoid data loss.

---

## ✨ Features

- 👥 **Customers & Suppliers** — Create, edit, and delete contact records (name, email, phone, notes)
- 🧾 **Invoices** — Create invoices with line items, tax rate, status (Draft / Issued / Paid), and auto-numbering
- 💸 **Expenses** — Record expenses with date, supplier, category, amount, and notes
- 📊 **Dashboard** — At-a-glance summary cards: paid revenue, total expenses, net balance, open invoices
- 📈 **Reports** — Profit & Loss and balance summary filterable by date range; expenses broken down by category
- 📤 **CSV Export / Import** — Download invoices and expenses as CSV; bulk-import from CSV
- 💾 **JSON Backup & Restore** — Export all data as a single JSON file and restore it later
- 🗑️ **Clear All Data** — Wipe localStorage with one click (after confirmation)
- 📱 **Responsive UI** — Works on desktop and tablet; mobile-friendly hamburger menu

---

## 🚀 Getting Started

### Option 1 — Use the live GitHub Pages site
Visit **[andy-and-terry.github.io/accounting-software](https://andy-and-terry.github.io/accounting-software)** — no installation needed.

### Option 2 — Run locally
1. Clone the repository:
   ```bash
   git clone https://github.com/andy-and-terry/accounting-software.git
   ```
2. Open `docs/index.html` directly in any modern browser:
   ```bash
   open docs/index.html
   # or on Linux:
   xdg-open docs/index.html
   ```
   No build step or server required.

---

## 🌐 Enable GitHub Pages (repository owners)

To serve the app from your own GitHub account:

1. Go to your repository on GitHub.
2. Click **Settings** → **Pages** (left sidebar).
3. Under **Source**, choose:
   - Branch: **`main`**
   - Folder: **`/docs`**
4. Click **Save**.
5. After a minute or two, GitHub will display the live URL (e.g. `https://<owner>.github.io/accounting-software`).

---

## 💾 Data Persistence & Backups

All data is stored in your **browser's localStorage** under the keys:

| Key | Contents |
|-----|----------|
| `acc_customers` | Customer records |
| `acc_suppliers` | Supplier records |
| `acc_invoices`  | Invoice records (with line items) |
| `acc_expenses`  | Expense records |

### ⚠️ Important warnings
- Data is **not synced** across devices or browsers.
- Clearing browser data / site data will **permanently delete** all records.
- Using a different browser or an incognito/private window gives you a **fresh, empty** database.

### Recommended backup workflow
1. Open the app → click **Backup** in the navigation.
2. Click **Export JSON Backup** to download a `.json` file.
3. Store the file somewhere safe (cloud storage, email to yourself, etc.).
4. To restore: click **Import / Restore** and select your backup file.

### CSV import format

**Expenses CSV** — required columns (case-insensitive):
```
Date, Supplier, Category, Amount, Notes
```

**Invoices CSV** — required columns:
```
InvoiceNumber, Date, Customer, Status, TaxRate, LineDesc, LineQty, LineUnitPrice, LineTotal, Subtotal, TaxAmt, Total, Notes
```
Multiple rows with the same `InvoiceNumber` are merged into one invoice with multiple line items.

---

## 🗂️ Project Structure

```
accounting-software/
├── docs/
│   ├── index.html   # Single-page app markup (all sections + modals)
│   ├── styles.css   # Responsive stylesheet
│   └── app.js       # All application logic (CRUD, CSV, JSON, reports)
├── LICENSE          # MIT License
└── README.md        # You are here
```

---

## 🛡️ Privacy

All financial data stays **on your device**. Nothing is ever sent to a server.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

> Made with ❤️ by [andy-and-terry](https://github.com/andy-and-terry)