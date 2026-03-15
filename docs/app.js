/* ==========================================================================
   Simple Accounting App — app.js
   All application logic: data models, localStorage, CRUD for customers /
   suppliers / invoices / expenses, CSV import/export, P&L and balance
   reports, and UI rendering / event handling.

   Structure:
     1.  Constants & helpers
     2.  localStorage persistence layer
     3.  Data models (initial empty state)
     4.  Section navigation
     5.  Modal helpers
     6.  Dashboard
     7.  Customers
     8.  Suppliers
     9.  Invoices (+ line items + totals)
    10.  Expenses
    11.  Reports (P&L, Balance, Expense by category)
    12.  CSV import / export
    13.  JSON backup / restore
    14.  Initialisation
   ========================================================================== */

/* ==========================================================================
   1. CONSTANTS & HELPERS
   ========================================================================== */

/** Keys used in localStorage */
const STORAGE_KEYS = {
  customers: 'acc_customers',
  suppliers: 'acc_suppliers',
  invoices:  'acc_invoices',
  expenses:  'acc_expenses',
};

/**
 * Generate a simple unique ID string (timestamp + random suffix).
 * Not cryptographically secure — fine for a local app.
 * @returns {string}
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Format a number as a currency string (2 decimal places).
 * @param {number} n
 * @returns {string}
 */
function money(n) {
  return parseFloat(n || 0).toFixed(2);
}

/**
 * Escape HTML special characters to prevent XSS when inserting untrusted
 * strings into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Return today's date as YYYY-MM-DD string (for default date inputs).
 * @returns {string}
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ==========================================================================
   2. LOCALSTORAGE PERSISTENCE LAYER
   ========================================================================== */

/**
 * Load an array from localStorage by key.
 * Returns an empty array if nothing is stored yet.
 * @param {string} key  - one of the STORAGE_KEYS values
 * @returns {Array}
 */
function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load from localStorage:', key, e);
    return [];
  }
}

/**
 * Save an array to localStorage by key.
 * @param {string} key
 * @param {Array}  data
 */
function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', key, e);
    alert('Storage error: could not save data. Your browser storage may be full.');
  }
}

/* ==========================================================================
   3. IN-MEMORY DATA STORE
   All data lives in these four arrays. They are loaded from localStorage
   on startup and written back to localStorage after every change.
   ========================================================================== */

let customers = [];   // [{ id, name, email, phone, notes, createdAt }]
let suppliers = [];   // [{ id, name, email, phone, notes, createdAt }]
let invoices  = [];   // [{ id, date, customerId, status, taxRate, notes, lineItems, subtotal, taxAmt, total }]
let expenses  = [];   // [{ id, date, supplierId, category, amount, notes, createdAt }]

/* ==========================================================================
   4. SECTION NAVIGATION
   ========================================================================== */

/**
 * Show the named section and highlight the matching nav button.
 * Called by nav button clicks and from inline onclick handlers.
 * @param {string} name - e.g. 'dashboard', 'customers', etc.
 */
function showSection(name) {
  // Hide all sections
  document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active'));
  // Deactivate all nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  // Show the requested section
  const section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');

  // Activate the matching nav button
  const btn = document.querySelector(`.nav-btn[data-section="${name}"]`);
  if (btn) btn.classList.add('active');

  // Close the mobile menu if open
  document.getElementById('mainNav').classList.remove('open');

  // Refresh the visible section's data
  if (name === 'dashboard')  renderDashboard();
  if (name === 'customers')  renderCustomers();
  if (name === 'suppliers')  renderSuppliers();
  if (name === 'invoices')   renderInvoices();
  if (name === 'expenses')   renderExpenses();
}

/* Attach nav button click handlers */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

/* Hamburger menu toggle */
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('mainNav').classList.toggle('open');
});

/* ==========================================================================
   5. MODAL HELPERS
   ========================================================================== */

/**
 * Open a modal by its element ID.
 * @param {string} id
 */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

/**
 * Close a modal by its element ID and reset the form inside it (if any).
 * @param {string} id
 */
function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('open');
  const form = overlay.querySelector('form');
  if (form) form.reset();
}

/* Close modal when clicking the dark overlay (outside the white box) */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) closeModal(this.id);
  });
});

/* ==========================================================================
   6. DASHBOARD
   ========================================================================== */

/**
 * Render the dashboard summary cards and the recent invoices / expenses tables.
 */
function renderDashboard() {
  // --- Summary numbers ---
  const paidInvoiceTotal = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const totalExpenses = expenses
    .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

  const netBalance = paidInvoiceTotal - totalExpenses;

  const openInvoiceTotal = invoices
    .filter(inv => inv.status === 'issued')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const cards = [
    { label: 'Paid Revenue',    value: '$' + money(paidInvoiceTotal), cls: 'positive' },
    { label: 'Total Expenses',  value: '$' + money(totalExpenses),    cls: 'negative' },
    { label: 'Net Balance',     value: '$' + money(netBalance),       cls: netBalance >= 0 ? 'positive' : 'negative' },
    { label: 'Open Invoices',   value: '$' + money(openInvoiceTotal), cls: '' },
    { label: 'Customers',       value: customers.length,              cls: '' },
    { label: 'Suppliers',       value: suppliers.length,              cls: '' },
  ];

  const cardsEl = document.getElementById('dashboardCards');
  cardsEl.innerHTML = cards.map(c => `
    <div class="summary-card">
      <div class="card-label">${esc(c.label)}</div>
      <div class="card-value ${c.cls}">${esc(String(c.value))}</div>
    </div>
  `).join('');

  // --- Recent invoices (last 5) ---
  const recentInvoices = [...invoices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const invTbody = document.querySelector('#dashRecentInvoices tbody');
  invTbody.innerHTML = recentInvoices.length === 0
    ? '<tr class="empty-row"><td colspan="5">No invoices yet.</td></tr>'
    : recentInvoices.map(inv => {
        const cust = customers.find(c => c.id === inv.customerId);
        return `<tr>
          <td>${esc(inv.invoiceNumber || inv.id)}</td>
          <td>${esc(cust ? cust.name : 'Unknown')}</td>
          <td>${esc(inv.date)}</td>
          <td class="text-right">$${money(inv.total)}</td>
          <td><span class="badge badge-${esc(inv.status)}">${esc(inv.status)}</span></td>
        </tr>`;
      }).join('');

  // --- Recent expenses (last 5) ---
  const recentExpenses = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const expTbody = document.querySelector('#dashRecentExpenses tbody');
  expTbody.innerHTML = recentExpenses.length === 0
    ? '<tr class="empty-row"><td colspan="4">No expenses yet.</td></tr>'
    : recentExpenses.map(exp => {
        const supp = suppliers.find(s => s.id === exp.supplierId);
        return `<tr>
          <td>${esc(exp.date)}</td>
          <td>${esc(supp ? supp.name : exp.supplierId ? '?' : '—')}</td>
          <td>${esc(exp.category)}</td>
          <td class="text-right">$${money(exp.amount)}</td>
        </tr>`;
      }).join('');
}

/* ==========================================================================
   7. CUSTOMERS
   ========================================================================== */

/** Re-render the customers table. */
function renderCustomers() {
  const tbody = document.querySelector('#customersTable tbody');
  if (customers.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No customers yet. Click "+ Add Customer" to get started.</td></tr>';
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.email)}</td>
      <td>${esc(c.phone)}</td>
      <td>${esc(c.notes)}</td>
      <td>
        <button class="btn btn-icon" onclick="editCustomer('${esc(c.id)}')">✏️ Edit</button>
        <button class="btn btn-icon" onclick="deleteCustomer('${esc(c.id)}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

/** Open the customer modal pre-filled for editing. */
function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('customerModalTitle').textContent = 'Edit Customer';
  document.getElementById('customerId').value    = c.id;
  document.getElementById('customerName').value  = c.name;
  document.getElementById('customerEmail').value = c.email || '';
  document.getElementById('customerPhone').value = c.phone || '';
  document.getElementById('customerNotes').value = c.notes || '';
  openModal('customerModal');
}

/** Delete a customer (with confirmation). */
function deleteCustomer(id) {
  if (!confirm('Delete this customer? This cannot be undone.')) return;
  customers = customers.filter(c => c.id !== id);
  save(STORAGE_KEYS.customers, customers);
  renderCustomers();
}

/** Handle customer form submission (create or update). */
function saveCustomer(event) {
  event.preventDefault();
  const id = document.getElementById('customerId').value;
  const record = {
    id:        id || uid(),
    name:      document.getElementById('customerName').value.trim(),
    email:     document.getElementById('customerEmail').value.trim(),
    phone:     document.getElementById('customerPhone').value.trim(),
    notes:     document.getElementById('customerNotes').value.trim(),
    createdAt: id ? (customers.find(c => c.id === id) || {}).createdAt || today() : today(),
  };

  if (id) {
    // Update existing
    customers = customers.map(c => c.id === id ? record : c);
  } else {
    customers.push(record);
  }

  save(STORAGE_KEYS.customers, customers);
  closeModal('customerModal');
  renderCustomers();

  // Reset title for next open
  document.getElementById('customerModalTitle').textContent = 'Add Customer';
}

/** Open the add-customer modal with a blank form. */
document.getElementById('customerForm').addEventListener('reset', () => {
  document.getElementById('customerId').value = '';
  document.getElementById('customerModalTitle').textContent = 'Add Customer';
});

/* ==========================================================================
   8. SUPPLIERS
   ========================================================================== */

/** Re-render the suppliers table. */
function renderSuppliers() {
  const tbody = document.querySelector('#suppliersTable tbody');
  if (suppliers.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No suppliers yet. Click "+ Add Supplier" to get started.</td></tr>';
    return;
  }
  tbody.innerHTML = suppliers.map(s => `
    <tr>
      <td>${esc(s.name)}</td>
      <td>${esc(s.email)}</td>
      <td>${esc(s.phone)}</td>
      <td>${esc(s.notes)}</td>
      <td>
        <button class="btn btn-icon" onclick="editSupplier('${esc(s.id)}')">✏️ Edit</button>
        <button class="btn btn-icon" onclick="deleteSupplier('${esc(s.id)}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

/** Open the supplier modal pre-filled for editing. */
function editSupplier(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
  document.getElementById('supplierId').value    = s.id;
  document.getElementById('supplierName').value  = s.name;
  document.getElementById('supplierEmail').value = s.email || '';
  document.getElementById('supplierPhone').value = s.phone || '';
  document.getElementById('supplierNotes').value = s.notes || '';
  openModal('supplierModal');
}

/** Delete a supplier (with confirmation). */
function deleteSupplier(id) {
  if (!confirm('Delete this supplier? This cannot be undone.')) return;
  suppliers = suppliers.filter(s => s.id !== id);
  save(STORAGE_KEYS.suppliers, suppliers);
  renderSuppliers();
}

/** Handle supplier form submission (create or update). */
function saveSupplier(event) {
  event.preventDefault();
  const id = document.getElementById('supplierId').value;
  const record = {
    id:        id || uid(),
    name:      document.getElementById('supplierName').value.trim(),
    email:     document.getElementById('supplierEmail').value.trim(),
    phone:     document.getElementById('supplierPhone').value.trim(),
    notes:     document.getElementById('supplierNotes').value.trim(),
    createdAt: id ? (suppliers.find(s => s.id === id) || {}).createdAt || today() : today(),
  };

  if (id) {
    suppliers = suppliers.map(s => s.id === id ? record : s);
  } else {
    suppliers.push(record);
  }

  save(STORAGE_KEYS.suppliers, suppliers);
  closeModal('supplierModal');
  renderSuppliers();
  document.getElementById('supplierModalTitle').textContent = 'Add Supplier';
}

/* ==========================================================================
   9. INVOICES
   ========================================================================== */

/**
 * Populate the customer <select> inside the invoice modal.
 * Called every time the modal is opened.
 */
function populateInvoiceCustomerSelect() {
  const sel = document.getElementById('invoiceCustomer');
  sel.innerHTML = customers.length === 0
    ? '<option value="">— No customers yet —</option>'
    : customers.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

/**
 * Add a blank line item row to the invoice line items table.
 * Each row has: description, qty, unit price, computed line total, remove button.
 */
function addLineItem(desc = '', qty = 1, unitPrice = 0) {
  const tbody = document.getElementById('lineItemsBody');
  const rowId = uid();
  const row = document.createElement('tr');
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <td><input type="text" class="li-desc" placeholder="Description" value="${esc(desc)}" oninput="recalcInvoiceTotals()" /></td>
    <td><input type="number" class="li-qty" min="0" step="1" value="${esc(qty)}" style="width:70px" oninput="recalcInvoiceTotals()" /></td>
    <td><input type="number" class="li-price" min="0" step="0.01" value="${esc(unitPrice)}" style="width:100px" oninput="recalcInvoiceTotals()" /></td>
    <td class="li-total text-right">$${money(qty * unitPrice)}</td>
    <td><button type="button" class="btn btn-icon btn-sm" onclick="removeLineItem('${rowId}')">✕</button></td>
  `;
  tbody.appendChild(row);
  recalcInvoiceTotals();
}

/**
 * Remove a line item row by its rowId and recalculate totals.
 * @param {string} rowId
 */
function removeLineItem(rowId) {
  const row = document.querySelector(`#lineItemsBody tr[data-row-id="${rowId}"]`);
  if (row) row.remove();
  recalcInvoiceTotals();
}

/**
 * Recalculate subtotal, tax, and total from all line item rows.
 * Updates the display elements in the modal footer.
 */
function recalcInvoiceTotals() {
  let subtotal = 0;
  document.querySelectorAll('#lineItemsBody tr').forEach(row => {
    const qty   = parseFloat(row.querySelector('.li-qty').value)   || 0;
    const price = parseFloat(row.querySelector('.li-price').value) || 0;
    const lineTotal = qty * price;
    row.querySelector('.li-total').textContent = '$' + money(lineTotal);
    subtotal += lineTotal;
  });
  const taxRate = parseFloat(document.getElementById('invoiceTaxRate').value) || 0;
  const taxAmt  = subtotal * (taxRate / 100);
  const total   = subtotal + taxAmt;

  document.getElementById('invoiceSubtotal').textContent = money(subtotal);
  document.getElementById('invoiceTaxAmt').textContent   = money(taxAmt);
  document.getElementById('invoiceTotal').textContent    = money(total);
}

/**
 * Collect line items from the DOM into an array of objects.
 * @returns {Array<{desc, qty, unitPrice, lineTotal}>}
 */
function collectLineItems() {
  const items = [];
  document.querySelectorAll('#lineItemsBody tr').forEach(row => {
    const desc  = row.querySelector('.li-desc').value.trim();
    const qty   = parseFloat(row.querySelector('.li-qty').value)   || 0;
    const price = parseFloat(row.querySelector('.li-price').value) || 0;
    items.push({ desc, qty, unitPrice: price, lineTotal: qty * price });
  });
  return items;
}

/**
 * Re-render the invoices table, optionally filtered by status and date range.
 */
function renderInvoices() {
  const statusFilter = document.getElementById('invoiceFilterStatus').value;
  const fromFilter   = document.getElementById('invoiceFilterFrom').value;
  const toFilter     = document.getElementById('invoiceFilterTo').value;

  let list = [...invoices].sort((a, b) => b.date.localeCompare(a.date));

  if (statusFilter) list = list.filter(inv => inv.status === statusFilter);
  if (fromFilter)   list = list.filter(inv => inv.date >= fromFilter);
  if (toFilter)     list = list.filter(inv => inv.date <= toFilter);

  const tbody = document.querySelector('#invoicesTable tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No invoices match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    return `<tr>
      <td>${esc(inv.invoiceNumber || inv.id)}</td>
      <td>${esc(inv.date)}</td>
      <td>${esc(cust ? cust.name : 'Unknown')}</td>
      <td class="text-right">$${money(inv.subtotal)}</td>
      <td class="text-right">$${money(inv.taxAmt)}</td>
      <td class="text-right">$${money(inv.total)}</td>
      <td><span class="badge badge-${esc(inv.status)}">${esc(inv.status)}</span></td>
      <td>
        <button class="btn btn-icon" onclick="viewInvoice('${esc(inv.id)}')">👁 View</button>
        <button class="btn btn-icon" onclick="editInvoice('${esc(inv.id)}')">✏️ Edit</button>
        <button class="btn btn-icon" onclick="deleteInvoice('${esc(inv.id)}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

/** Open the invoice form modal ready to create a new invoice. */
function openInvoiceModal() {
  document.getElementById('invoiceModalTitle').textContent = 'New Invoice';
  document.getElementById('invoiceId').value     = '';
  document.getElementById('invoiceDate').value   = today();
  document.getElementById('invoiceTaxRate').value = '0';
  document.getElementById('invoiceNotes').value   = '';
  document.getElementById('invoiceStatus').value  = 'draft';
  document.getElementById('lineItemsBody').innerHTML = '';
  populateInvoiceCustomerSelect();
  addLineItem(); // Start with one blank line
  recalcInvoiceTotals();
  openModal('invoiceModal');
}

/** Pre-fill the invoice modal with an existing invoice's data for editing. */
function editInvoice(id) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;

  document.getElementById('invoiceModalTitle').textContent = 'Edit Invoice';
  document.getElementById('invoiceId').value      = inv.id;
  document.getElementById('invoiceDate').value    = inv.date;
  document.getElementById('invoiceTaxRate').value = inv.taxRate || 0;
  document.getElementById('invoiceNotes').value   = inv.notes || '';
  document.getElementById('invoiceStatus').value  = inv.status;

  populateInvoiceCustomerSelect();
  document.getElementById('invoiceCustomer').value = inv.customerId;

  // Restore line items
  document.getElementById('lineItemsBody').innerHTML = '';
  (inv.lineItems || []).forEach(li => addLineItem(li.desc, li.qty, li.unitPrice));
  if ((inv.lineItems || []).length === 0) addLineItem();

  recalcInvoiceTotals();
  openModal('invoiceModal');
}

/** Show a read-only detail view of an invoice. */
function viewInvoice(id) {
  const inv = invoices.find(x => x.id === id);
  if (!inv) return;
  const cust = customers.find(c => c.id === inv.customerId);

  const lines = (inv.lineItems || []).map(li => `
    <tr>
      <td>${esc(li.desc)}</td>
      <td class="text-right">${esc(li.qty)}</td>
      <td class="text-right">$${money(li.unitPrice)}</td>
      <td class="text-right">$${money(li.lineTotal)}</td>
    </tr>
  `).join('');

  document.getElementById('invoiceViewContent').innerHTML = `
    <table class="data-table" style="max-width:500px;margin-bottom:.75rem">
      <tbody>
        <tr><th>Invoice #</th><td>${esc(inv.invoiceNumber || inv.id)}</td></tr>
        <tr><th>Date</th><td>${esc(inv.date)}</td></tr>
        <tr><th>Customer</th><td>${esc(cust ? cust.name : 'Unknown')}</td></tr>
        <tr><th>Status</th><td><span class="badge badge-${esc(inv.status)}">${esc(inv.status)}</span></td></tr>
        <tr><th>Notes</th><td>${esc(inv.notes)}</td></tr>
      </tbody>
    </table>
    <table class="data-table">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${lines}</tbody>
      <tfoot>
        <tr><td colspan="3" class="text-right"><strong>Subtotal</strong></td><td class="text-right">$${money(inv.subtotal)}</td></tr>
        <tr><td colspan="3" class="text-right"><strong>Tax (${inv.taxRate || 0}%)</strong></td><td class="text-right">$${money(inv.taxAmt)}</td></tr>
        <tr><td colspan="3" class="text-right"><strong>Total</strong></td><td class="text-right"><strong>$${money(inv.total)}</strong></td></tr>
      </tfoot>
    </table>
  `;
  openModal('invoiceViewModal');
}

/** Delete an invoice with confirmation. */
function deleteInvoice(id) {
  if (!confirm('Delete this invoice? This cannot be undone.')) return;
  invoices = invoices.filter(inv => inv.id !== id);
  save(STORAGE_KEYS.invoices, invoices);
  renderInvoices();
}

/** Handle invoice form submission (create or update). */
function saveInvoice(event) {
  event.preventDefault();
  const id      = document.getElementById('invoiceId').value;
  const lineItems = collectLineItems();
  const subtotal  = lineItems.reduce((s, li) => s + li.lineTotal, 0);
  const taxRate   = parseFloat(document.getElementById('invoiceTaxRate').value) || 0;
  const taxAmt    = subtotal * (taxRate / 100);
  const total     = subtotal + taxAmt;

  // Auto-generate a sequential invoice number for new invoices
  const invoiceNumber = id
    ? (invoices.find(x => x.id === id) || {}).invoiceNumber
    : 'INV-' + String(invoices.length + 1).padStart(4, '0');

  const record = {
    id:            id || uid(),
    invoiceNumber: invoiceNumber,
    date:          document.getElementById('invoiceDate').value,
    customerId:    document.getElementById('invoiceCustomer').value,
    status:        document.getElementById('invoiceStatus').value,
    taxRate:       taxRate,
    notes:         document.getElementById('invoiceNotes').value.trim(),
    lineItems:     lineItems,
    subtotal:      subtotal,
    taxAmt:        taxAmt,
    total:         total,
    createdAt:     id ? (invoices.find(x => x.id === id) || {}).createdAt || today() : today(),
  };

  if (id) {
    invoices = invoices.map(inv => inv.id === id ? record : inv);
  } else {
    invoices.push(record);
  }

  save(STORAGE_KEYS.invoices, invoices);
  closeModal('invoiceModal');
  renderInvoices();
}

/* ==========================================================================
   10. EXPENSES
   ========================================================================== */

/**
 * Populate the supplier <select> inside the expense modal.
 */
function populateExpenseSupplierSelect() {
  const sel = document.getElementById('expenseSupplier');
  const current = sel.value;
  sel.innerHTML = '<option value="">— None —</option>' +
    suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  if (current) sel.value = current;
}

/**
 * Re-render the expenses table, optionally filtered by category and date range.
 */
function renderExpenses() {
  const catFilter  = document.getElementById('expenseFilterCategory').value;
  const fromFilter = document.getElementById('expenseFilterFrom').value;
  const toFilter   = document.getElementById('expenseFilterTo').value;

  // Update category filter dropdown with distinct categories
  const categories = [...new Set(expenses.map(e => e.category))].sort();
  const filterSel  = document.getElementById('expenseFilterCategory');
  const curVal     = filterSel.value;
  filterSel.innerHTML = '<option value="">All</option>' +
    categories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
  filterSel.value = curVal;

  let list = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  if (catFilter)  list = list.filter(e => e.category === catFilter);
  if (fromFilter) list = list.filter(e => e.date >= fromFilter);
  if (toFilter)   list = list.filter(e => e.date <= toFilter);

  const tbody = document.querySelector('#expensesTable tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No expenses match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(exp => {
    const supp = suppliers.find(s => s.id === exp.supplierId);
    return `<tr>
      <td>${esc(exp.date)}</td>
      <td>${esc(supp ? supp.name : exp.supplierId ? '?' : '—')}</td>
      <td>${esc(exp.category)}</td>
      <td class="text-right">$${money(exp.amount)}</td>
      <td>${esc(exp.notes)}</td>
      <td>
        <button class="btn btn-icon" onclick="editExpense('${esc(exp.id)}')">✏️ Edit</button>
        <button class="btn btn-icon" onclick="deleteExpense('${esc(exp.id)}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

/** Pre-fill the expense modal for editing. */
function editExpense(id) {
  const exp = expenses.find(x => x.id === id);
  if (!exp) return;
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseId').value       = exp.id;
  document.getElementById('expenseDate').value     = exp.date;
  document.getElementById('expenseAmount').value   = exp.amount;
  document.getElementById('expenseCategory').value = exp.category;
  document.getElementById('expenseNotes').value    = exp.notes || '';
  populateExpenseSupplierSelect();
  document.getElementById('expenseSupplier').value = exp.supplierId || '';
  openModal('expenseModal');
}

/** Delete an expense with confirmation. */
function deleteExpense(id) {
  if (!confirm('Delete this expense? This cannot be undone.')) return;
  expenses = expenses.filter(e => e.id !== id);
  save(STORAGE_KEYS.expenses, expenses);
  renderExpenses();
}

/** Handle expense form submission (create or update). */
function saveExpense(event) {
  event.preventDefault();
  const id = document.getElementById('expenseId').value;
  const record = {
    id:         id || uid(),
    date:       document.getElementById('expenseDate').value,
    supplierId: document.getElementById('expenseSupplier').value,
    category:   document.getElementById('expenseCategory').value,
    amount:     parseFloat(document.getElementById('expenseAmount').value) || 0,
    notes:      document.getElementById('expenseNotes').value.trim(),
    createdAt:  id ? (expenses.find(e => e.id === id) || {}).createdAt || today() : today(),
  };

  if (id) {
    expenses = expenses.map(e => e.id === id ? record : e);
  } else {
    expenses.push(record);
  }

  save(STORAGE_KEYS.expenses, expenses);
  closeModal('expenseModal');
  renderExpenses();
  document.getElementById('expenseModalTitle').textContent = 'New Expense';
}

function openExpenseModal() {
  document.getElementById('expenseModalTitle').textContent = 'New Expense';
  document.getElementById('expenseId').value     = '';
  document.getElementById('expenseDate').value   = today();
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseNotes').value  = '';
  document.getElementById('expenseCategory').value = 'Other';
  populateExpenseSupplierSelect();
  openModal('expenseModal');
}

/* ==========================================================================
   11. REPORTS (Profit & Loss, Balance, Expense by Category)
   ========================================================================== */

/**
 * Generate the P&L and balance report for the selected date range.
 * Reads the "from" and "to" inputs and computes:
 *   - Income: sum of paid invoice totals in range
 *   - Expenses grouped by category
 *   - Net profit/loss
 *   - Balance: cash on hand = paid invoices − all expenses
 */
function generateReport() {
  const from = document.getElementById('reportFrom').value;
  const to   = document.getElementById('reportTo').value;

  // Filter paid invoices in range
  const filteredInvoices = invoices.filter(inv => {
    if (inv.status !== 'paid') return false;
    if (from && inv.date < from) return false;
    if (to   && inv.date > to)   return false;
    return true;
  });

  // Filter expenses in range
  const filteredExpenses = expenses.filter(exp => {
    if (from && exp.date < from) return false;
    if (to   && exp.date > to)   return false;
    return true;
  });

  const totalIncome   = filteredInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0);
  const netProfit     = totalIncome - totalExpenses;

  // --- P&L Table ---
  const plTbody = document.querySelector('#plTable tbody');
  const plFoot  = document.getElementById('plFoot');

  plTbody.innerHTML = `
    <tr><td>Total Income (paid invoices)</td><td class="text-right">$${money(totalIncome)}</td></tr>
    <tr><td>Total Expenses</td><td class="text-right">−$${money(totalExpenses)}</td></tr>
  `;
  plFoot.innerHTML = `
    <tr>
      <td><strong>Net Profit / (Loss)</strong></td>
      <td class="text-right" style="color:${netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
        <strong>${netProfit >= 0 ? '' : '('}$${money(Math.abs(netProfit))}${netProfit >= 0 ? '' : ')'}</strong>
      </td>
    </tr>
  `;

  // --- Balance Table ---
  // All paid invoices ever (cash received) minus all expenses ever
  const allPaidIncome = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((s, inv) => s + (inv.total || 0), 0);
  const allExpenses   = expenses.reduce((s, exp) => s + (parseFloat(exp.amount) || 0), 0);
  const cashOnHand    = allPaidIncome - allExpenses;

  const balTbody = document.querySelector('#balanceTable tbody');
  balTbody.innerHTML = `
    <tr><td>Cash received (all paid invoices)</td><td class="text-right">$${money(allPaidIncome)}</td></tr>
    <tr><td>Total expenses paid out</td><td class="text-right">−$${money(allExpenses)}</td></tr>
    <tr>
      <td><strong>Estimated Cash on Hand</strong></td>
      <td class="text-right" style="color:${cashOnHand >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
        <strong>$${money(cashOnHand)}</strong>
      </td>
    </tr>
  `;

  // --- Expenses by Category (filtered range) ---
  const byCategory = {};
  filteredExpenses.forEach(exp => {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + (parseFloat(exp.amount) || 0);
  });
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const catTbody = document.querySelector('#expCatTable tbody');
  catTbody.innerHTML = catEntries.length === 0
    ? '<tr class="empty-row"><td colspan="2">No expenses in this date range.</td></tr>'
    : catEntries.map(([cat, amt]) => `
        <tr><td>${esc(cat)}</td><td class="text-right">$${money(amt)}</td></tr>
      `).join('');

  document.getElementById('reportOutput').style.display = 'block';
}

/* ==========================================================================
   12. CSV IMPORT / EXPORT
   ========================================================================== */

/* ------ Invoices CSV ------ */

/**
 * Download all invoices as a CSV file.
 * Each line item becomes a separate row (so multi-item invoices have multiple rows).
 * Columns: InvoiceNumber, Date, Customer, Status, TaxRate, LineDesc, LineQty,
 *          LineUnitPrice, LineTotal, Subtotal, TaxAmt, Total, Notes
 */
function exportInvoicesCSV() {
  const headers = [
    'InvoiceNumber','Date','Customer','Status','TaxRate',
    'LineDesc','LineQty','LineUnitPrice','LineTotal',
    'Subtotal','TaxAmt','Total','Notes'
  ];
  const rows = [];
  invoices.forEach(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    const custName = cust ? cust.name : '';
    const lineItems = inv.lineItems && inv.lineItems.length > 0 ? inv.lineItems : [{}];
    lineItems.forEach(li => {
      rows.push([
        inv.invoiceNumber || inv.id,
        inv.date,
        custName,
        inv.status,
        inv.taxRate || 0,
        li.desc || '',
        li.qty || '',
        li.unitPrice || '',
        li.lineTotal || '',
        inv.subtotal || 0,
        inv.taxAmt || 0,
        inv.total || 0,
        inv.notes || '',
      ]);
    });
  });

  downloadCSV('invoices.csv', headers, rows);
}

/**
 * Import invoices from a CSV file.
 * Expected columns (case-insensitive): InvoiceNumber, Date, Customer, Status,
 * TaxRate, LineDesc, LineQty, LineUnitPrice, Subtotal, TaxAmt, Total, Notes.
 * Multiple rows with the same InvoiceNumber are merged into one invoice with
 * multiple line items.
 * @param {Event} event - file input change event
 */
function importInvoicesCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  readCSV(file, rows => {
    // Group rows by InvoiceNumber
    const grouped = {};
    rows.forEach(row => {
      const num = row['invoicenumber'] || row['invoiceNumber'] || '';
      if (!grouped[num]) grouped[num] = { rows: [] };
      grouped[num].rows.push(row);
    });

    let added = 0;
    Object.entries(grouped).forEach(([num, group]) => {
      const first = group.rows[0];
      const date    = first['date'] || today();
      const status  = first['status'] || 'draft';
      const taxRate = parseFloat(first['taxrate'] || first['taxRate'] || 0);
      const notes   = first['notes'] || '';
      const custName = first['customer'] || '';

      // Find or skip customer lookup (CSV import won't auto-create customers)
      const cust = customers.find(c => c.name.toLowerCase() === custName.toLowerCase());

      const lineItems = group.rows.map(r => ({
        desc:      r['linedesc'] || r['lineDesc'] || '',
        qty:       parseFloat(r['lineqty'] || r['lineQty'] || 1),
        unitPrice: parseFloat(r['lineunitprice'] || r['lineUnitPrice'] || 0),
        lineTotal: parseFloat(r['linetotal'] || r['lineTotal'] || 0),
      })).filter(li => li.desc);

      const subtotal = lineItems.reduce((s, li) => s + li.lineTotal, 0);
      const taxAmt   = subtotal * (taxRate / 100);
      const total    = subtotal + taxAmt;

      const record = {
        id:            uid(),
        invoiceNumber: num || 'INV-' + String(invoices.length + added + 1).padStart(4, '0'),
        date,
        customerId:    cust ? cust.id : '',
        status,
        taxRate,
        notes,
        lineItems,
        subtotal,
        taxAmt,
        total,
        createdAt: today(),
      };
      invoices.push(record);
      added++;
    });

    save(STORAGE_KEYS.invoices, invoices);
    renderInvoices();
    alert(`Imported ${added} invoice(s) from CSV.`);
  });
  // Reset file input so the same file can be re-imported
  event.target.value = '';
}

/* ------ Expenses CSV ------ */

/**
 * Download all expenses as a CSV file.
 * Columns: Date, Supplier, Category, Amount, Notes
 */
function exportExpensesCSV() {
  const headers = ['Date','Supplier','Category','Amount','Notes'];
  const rows = expenses.map(exp => {
    const supp = suppliers.find(s => s.id === exp.supplierId);
    return [
      exp.date,
      supp ? supp.name : '',
      exp.category,
      money(exp.amount),
      exp.notes || '',
    ];
  });
  downloadCSV('expenses.csv', headers, rows);
}

/**
 * Import expenses from a CSV file.
 * Expected columns (case-insensitive): Date, Supplier, Category, Amount, Notes.
 * @param {Event} event - file input change event
 */
function importExpensesCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  readCSV(file, rows => {
    let added = 0;
    rows.forEach(row => {
      const suppName = row['supplier'] || '';
      const supp = suppliers.find(s => s.name.toLowerCase() === suppName.toLowerCase());
      const record = {
        id:         uid(),
        date:       row['date'] || today(),
        supplierId: supp ? supp.id : '',
        category:   row['category'] || 'Other',
        amount:     parseFloat(row['amount'] || 0),
        notes:      row['notes'] || '',
        createdAt:  today(),
      };
      expenses.push(record);
      added++;
    });
    save(STORAGE_KEYS.expenses, expenses);
    renderExpenses();
    alert(`Imported ${added} expense(s) from CSV.`);
  });
  event.target.value = '';
}

/* ------ CSV Utilities ------ */

/**
 * Build and trigger download of a CSV file.
 * @param {string}   filename
 * @param {string[]} headers  - column header names
 * @param {Array[]}  rows     - array of arrays (one per row)
 */
function downloadCSV(filename, headers, rows) {
  const csvLines = [headers, ...rows].map(row =>
    row.map(cell => {
      const val = String(cell === null || cell === undefined ? '' : cell);
      // Wrap in quotes if the value contains comma, quote, or newline
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Read a CSV file and parse it into an array of plain objects (header → value).
 * Headers are converted to lower-case keys for case-insensitive lookup.
 * Calls `callback(rows)` with the result.
 * @param {File}     file
 * @param {function} callback
 */
function readCSV(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const text  = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      alert('CSV file is empty or has no data rows.');
      return;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows    = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length === 0 || cells.every(c => c === '')) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cells[idx] !== undefined ? cells[idx] : ''; });
      rows.push(obj);
    }
    callback(rows);
  };
  reader.readAsText(file);
}

/**
 * Parse a single CSV line, respecting quoted fields that may contain commas.
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const result = [];
  let currentField  = '';
  let inQuotes  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { currentField += '"'; i++; }
        else inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(currentField);
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }
  result.push(currentField);
  return result;
}

/* ==========================================================================
   13. JSON BACKUP / RESTORE
   ========================================================================== */

/**
 * Export the entire data set as a JSON file for backup.
 * The file can be re-imported using importJSON().
 */
function exportJSON() {
  const payload = {
    version:   1,
    exportedAt: new Date().toISOString(),
    customers,
    suppliers,
    invoices,
    expenses,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'accounting-backup-' + today() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import (restore) data from a previously exported JSON backup.
 * Overwrites all current data after user confirmation.
 * @param {Event} event - file input change event
 */
function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm(
    'This will OVERWRITE all current data with the contents of the backup file.\n\n' +
    'Make sure you have a copy of your current data first.\n\nProceed?'
  )) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      customers = Array.isArray(data.customers) ? data.customers : [];
      suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
      invoices  = Array.isArray(data.invoices)  ? data.invoices  : [];
      expenses  = Array.isArray(data.expenses)  ? data.expenses  : [];

      save(STORAGE_KEYS.customers, customers);
      save(STORAGE_KEYS.suppliers, suppliers);
      save(STORAGE_KEYS.invoices,  invoices);
      save(STORAGE_KEYS.expenses,  expenses);

      alert('Backup restored successfully!');
      showSection('dashboard');
    } catch (err) {
      alert('Failed to parse the JSON file. Make sure it is a valid backup.');
      console.error(err);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/**
 * Clear ALL data from localStorage and reset in-memory arrays.
 * Requires user confirmation.
 */
function clearAllData() {
  if (!confirm(
    'This will permanently delete ALL customers, suppliers, invoices, and expenses.\n\n' +
    'This cannot be undone. Are you sure?'
  )) return;

  customers = [];
  suppliers = [];
  invoices  = [];
  expenses  = [];

  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  alert('All data cleared.');
  showSection('dashboard');
}

/* ==========================================================================
   14. INITIALISATION
   Boot sequence: load data from localStorage, then render the default section.
   ========================================================================== */

(function init() {
  // Load all data from localStorage
  customers = load(STORAGE_KEYS.customers);
  suppliers = load(STORAGE_KEYS.suppliers);
  invoices  = load(STORAGE_KEYS.invoices);
  expenses  = load(STORAGE_KEYS.expenses);

  // Show the dashboard on first load
  showSection('dashboard');
})();
