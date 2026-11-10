// ================================================================
// UXONIC ERP — pure calculation helpers
// Shared by the browser (erp/js/*) and the API (api/erp.js) so the
// numbers shown while editing always match what the server saves.
// No dependencies, no DOM, no I/O.
// ================================================================

export const round2 = (n) => Math.round((Number(n) || 0) * 100 + Number.EPSILON) / 100;

/** 'YYYY-MM-DD' for a Date in local time */
export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse 'YYYY-MM-DD' as a local date (no timezone shift) */
export function parseYmd(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'YYYY-MM' → { first: 'YYYY-MM-01', last: 'YYYY-MM-DD', days } */
export function monthRange(month) {
  const [y, m] = String(month).slice(0, 7).split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const p = (n) => String(n).padStart(2, '0');
  return { first: `${y}-${p(m)}-01`, last: `${y}-${p(m)}-${p(days)}`, days, year: y, month: m };
}

/** All dates in a month as 'YYYY-MM-DD' */
export function monthDates(month) {
  const { year, month: m, days } = monthRange(month);
  const out = [];
  for (let d = 1; d <= days; d++) out.push(ymd(new Date(year, m - 1, d)));
  return out;
}

/** Working days in a month = all days except the weekly-off weekdays (0 = Sunday … 6 = Saturday) */
export function workingDates(month, weeklyOff = [0]) {
  const off = new Set((weeklyOff || []).map(Number));
  return monthDates(month).filter((s) => !off.has(parseYmd(s).getDay()));
}

export const ATTENDANCE_VALUE = { present: 1, 'half-day': 0.5, leave: 1, holiday: 1, absent: 0 };

/**
 * Salary for one employee for one month.
 *  - Denominator: working days of the full month (so a mid-month joiner is prorated).
 *  - Paid days: present (1) + half-day (0.5) + paid leave (1) + holiday (1).
 *    Paid days are capped at the working days inside the employee's employment window.
 *  - Working days with no attendance record are reported as "unmarked" and are NOT paid.
 */
export function computePayroll({ month, salary, joinDate, exitDate, attendance = [], weeklyOff = [0],
  allowances = 0, bonus = 0, deductions = 0, statutory = null, advanceDue = 0 }) {
  const all = workingDates(month, weeklyOff);
  const inWindow = all.filter((d) => (!joinDate || d >= joinDate) && (!exitDate || d <= exitDate));
  const byDate = new Map(attendance.map((a) => [String(a.date).slice(0, 10), a.status]));

  let present = 0, half = 0, leave = 0, holiday = 0, absent = 0;
  for (const status of byDate.values()) {
    if (status === 'present') present++;
    else if (status === 'half-day') half++;
    else if (status === 'leave') leave++;
    else if (status === 'holiday') holiday++;
    else if (status === 'absent') absent++;
  }
  const unmarked = inWindow.filter((d) => !byDate.has(d)).length;
  const rawPaid = present + half * 0.5 + leave + holiday;
  const paidDays = Math.min(rawPaid, inWindow.length);
  const workingDays = all.length;
  const earned = workingDays ? round2((Number(salary) || 0) * paidDays / workingDays) : 0;
  const gross = round2(earned + (Number(allowances) || 0) + (Number(bonus) || 0));
  const st = statutoryDeductions({ earned, gross, salary, ...(statutory || {}) });
  const beforeAdvance = round2(gross - (Number(deductions) || 0) - st.pf - st.esi - st.tds);
  const advance = round2(Math.max(0, Math.min(Number(advanceDue) || 0, beforeAdvance)));
  const net = round2(beforeAdvance - advance);

  return {
    pf: st.pf, esi: st.esi, tds: st.tds, advance_deduction: advance,
    working_days: workingDays,
    paid_days: paidDays,
    present_days: present,
    half_days: half,
    leave_days: leave + holiday,
    absent_days: absent,
    unmarked_days: unmarked,
    monthly_salary: round2(salary),
    earned,
    allowances: round2(allowances),
    bonus: round2(bonus),
    deductions: round2(deductions),
    net_pay: net,
  };
}

/**
 * Simplified Indian statutory deductions (employee share only — confirm with your CA):
 *  PF : 12% of earned basic, wage ceiling ₹15,000          (when pf is on)
 *  ESI: 0.75% of gross, only if monthly salary ≤ ₹21,000   (when esi is on)
 *  TDS: flat tdsPercent of gross (e.g. 10% for contractors under 194J)
 */
export function statutoryDeductions({ earned = 0, gross = 0, salary = 0, pf = false, esi = false, tdsPercent = 0 }) {
  return {
    pf: pf ? round2(Math.min(Number(earned) || 0, 15000) * 0.12) : 0,
    esi: esi && (Number(salary) || 0) <= 21000 ? round2(Math.ceil((Number(gross) || 0) * 0.0075 * 100) / 100) : 0,
    tds: round2((Number(gross) || 0) * (Number(tdsPercent) || 0) / 100),
  };
}

/** Salary that applies to a month, from salary history ({effective_from, monthly_salary}); fallback = current salary */
export function salaryForMonth(history = [], month, fallback = 0) {
  const last = monthRange(month).last;
  const applicable = history
    .filter((h) => String(h.effective_from) <= last)
    .sort((a, b) => String(b.effective_from).localeCompare(String(a.effective_from)));
  if (applicable.length) return Number(applicable[0].monthly_salary) || 0;
  // month is before any recorded change → the earliest known salary
  const earliest = [...history].sort((a, b) => String(a.effective_from).localeCompare(String(b.effective_from)))[0];
  return earliest ? Number(earliest.monthly_salary) || 0 : Number(fallback) || 0;
}

/**
 * Split each worked day across products.
 * attendance: [{employee_id, date, status, product_id}]  timesheets: [{employee_id, date, product_id, hours}]
 * A present day = 1, half day = 0.5. If timesheets exist for that person+date, the day is split
 * by hours; otherwise it goes to the attendance "worked on" product.
 * Returns [{employee_id, product_id, date, days}]
 */
export function allocateWork(attendance = [], timesheets = []) {
  const ts = new Map();
  timesheets.forEach((t) => {
    const k = `${t.employee_id}|${String(t.date).slice(0, 10)}`;
    if (!ts.has(k)) ts.set(k, []);
    ts.get(k).push(t);
  });
  const out = [];
  attendance.forEach((a) => {
    const v = a.status === 'present' ? 1 : a.status === 'half-day' ? 0.5 : 0;
    if (!v) return;
    const date = String(a.date).slice(0, 10);
    const entries = ts.get(`${a.employee_id}|${date}`) || [];
    const hours = entries.reduce((s, t) => s + (Number(t.hours) || 0), 0);
    if (hours > 0) {
      const byProduct = new Map();
      entries.forEach((t) => byProduct.set(t.product_id, (byProduct.get(t.product_id) || 0) + Number(t.hours)));
      byProduct.forEach((h, product_id) => out.push({ employee_id: a.employee_id, product_id, date, days: v * h / hours }));
    } else if (a.product_id) {
      out.push({ employee_id: a.employee_id, product_id: a.product_id, date, days: v });
    }
  });
  return out;
}

/** Working dates between two dates (inclusive), skipping weekly-off days */
export function workingDatesBetween(from, to, weeklyOff = [0]) {
  const off = new Set((weeklyOff || []).map(Number));
  const out = [];
  const d = parseYmd(from), end = parseYmd(to);
  for (let i = 0; d <= end && i < 400; i++) {
    if (!off.has(d.getDay())) out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Add months to a date, clamping the day (Jan 31 + 1 month → Feb 28/29) */
export function addMonths(dateStr, n) {
  const d = parseYmd(dateStr);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return ymd(t);
}

export function addDays(dateStr, n) {
  const d = parseYmd(dateStr);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Current date/time in India (IST), regardless of the server's timezone */
export function istNow() {
  const d = new Date();
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 330 * 60000);
}
export const istToday = () => ymd(istNow());
export const istTime = () => {
  const d = istNow();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Daily cost of an employee in a given month (used for product/project costing) */
export function dailyRate(salary, month, weeklyOff = [0]) {
  const wd = workingDates(month, weeklyOff).length;
  return wd ? (Number(salary) || 0) / wd : 0;
}

/**
 * Invoice totals.
 *  taxType: 'cgst_sgst' (same state), 'igst' (other state) or 'none'
 */
export function computeInvoice({ items = [], gstRate = 18, discount = 0, taxType = 'cgst_sgst' }) {
  const lines = items
    .filter((it) => String(it.description || '').trim())
    .map((it, i) => {
      const quantity = round2(it.quantity ?? 1);
      const rate = round2(it.rate ?? 0);
      return {
        position: i + 1,
        description: String(it.description).trim().slice(0, 500),
        hsn_sac: String(it.hsn_sac || '').trim().slice(0, 20) || null,
        quantity, rate, amount: round2(quantity * rate),
      };
    });
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const disc = Math.min(round2(discount), subtotal);
  const taxable = round2(subtotal - disc);
  const r = Number(gstRate) || 0;
  let cgst = 0, sgst = 0, igst = 0;
  const type = r > 0 ? taxType : 'none';
  if (type === 'cgst_sgst') { cgst = round2(taxable * r / 200); sgst = cgst; }
  else if (type === 'igst') { igst = round2(taxable * r / 100); }
  const total = round2(taxable + cgst + sgst + igst);
  return { items: lines, subtotal, discount: disc, taxable, gst_rate: r, tax_type: type, cgst, sgst, igst, total };
}

/** Same state code (or unknown client state) → CGST+SGST, otherwise IGST */
export function taxTypeFor(companyStateCode, clientStateCode) {
  if (!clientStateCode || !companyStateCode) return 'cgst_sgst';
  return String(companyStateCode).trim() === String(clientStateCode).trim() ? 'cgst_sgst' : 'igst';
}

/** Indian financial year label for a date, e.g. 2026-11-10 → '2026-27' */
export function financialYear(dateStr) {
  const d = parseYmd(dateStr);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Effective invoice status (adds 'overdue' for unpaid invoices past the due date) */
export function invoiceStatus(inv, today = ymd(new Date())) {
  if (['sent', 'partially-paid'].includes(inv.status) && inv.due_date && String(inv.due_date) < today) return 'overdue';
  return inv.status;
}

/** Status after a payment change */
export function statusFromPayments(total, paid, current) {
  if (current === 'cancelled') return 'cancelled';
  if (paid >= total - 0.005 && total > 0) return 'paid';
  if (paid > 0) return 'partially-paid';
  return current === 'draft' ? 'draft' : 'sent';
}

/** ₹1,23,456.00 */
export function inr(n, withSymbol = true) {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < -0.004 ? '−' : '') + (withSymbol ? '₹' : '') + s;
}

/** Amount in words, Indian numbering: "Rupees One Lakh Twenty Three Thousand … Only" */
export function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
  const three = (n) => {
    const h = Math.floor(n / 100), r = n % 100;
    return [h ? ones[h] + ' Hundred' : '', r ? two(r) : ''].filter(Boolean).join(' ');
  };
  const words = (n) => {
    if (n === 0) return 'Zero';
    const parts = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push(words(crore) + ' Crore');
    if (lakh) parts.push(two(lakh) + ' Lakh');
    if (thousand) parts.push(two(thousand) + ' Thousand');
    if (n) parts.push(three(n));
    return parts.join(' ');
  };
  const v = round2(Math.abs(amount));
  const rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  return 'Rupees ' + words(rupees) + (paise ? ' and ' + two(paise) + ' Paise' : '') + ' Only';
}
