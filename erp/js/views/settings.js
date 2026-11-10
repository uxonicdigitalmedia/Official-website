import { api, pageHead, formHtml, readForm, toast, toastErr } from '../core.js';
import { STATES } from './clients.js';

const yesNo = [['true', 'On'], ['false', 'Off']];
const FIELDS = [
  { type: 'section', label: 'Company (printed on invoices, quotations & payslips)' },
  { name: 'company_name', label: 'Company name', required: true },
  { name: 'gstin', label: 'GSTIN', placeholder: '33ABCDE1234F1Z5' },
  { name: 'pan', label: 'PAN' },
  { name: 'state_code', label: 'State', type: 'select', options: STATES, blank: false, hint: 'Decides CGST+SGST vs IGST on invoices' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'website', label: 'Website' },
  { name: 'portal_url', label: 'Website URL for portal links', hint: 'Used in emails, e.g. https://www.uxonicdigital.com' },
  { name: 'address', label: 'Address', type: 'textarea', span: 2, rows: 3 },
  { type: 'section', label: 'Bank details (shown on invoices)' },
  { name: 'bank_name', label: 'Bank name' },
  { name: 'bank_account', label: 'Account number' },
  { name: 'bank_ifsc', label: 'IFSC' },
  { name: 'upi_id', label: 'UPI ID' },
  { type: 'section', label: 'Invoices & quotations' },
  { name: 'invoice_prefix', label: 'Invoice number prefix', required: true, hint: 'UXN → UXN/2026-27/0001' },
  { name: 'quote_prefix', label: 'Quotation number prefix', hint: 'QT → QT/2026-27/0001' },
  { name: 'default_gst_rate', label: 'Default GST rate', type: 'select', blank: false, options: [[0, '0%'], [5, '5%'], [12, '12%'], [18, '18%'], [28, '28%']] },
  { name: 'auto_reminders', label: 'Automatic overdue reminders', type: 'select', blank: false, options: yesNo, hint: 'Emails clients when an invoice is past due' },
  { name: 'reminder_every_days', label: 'Remind again every (days)', type: 'number' },
  { name: 'invoice_terms', label: 'Default notes / terms', type: 'textarea', span: 2, rows: 3 },
  { type: 'section', label: 'Payroll & leave' },
  { name: 'weekly_off', label: 'Weekly off days (not working days)', type: 'weekdays', span: 2 },
  { name: 'leave_casual', label: 'Casual leave per year', type: 'number', step: '0.5' },
  { name: 'leave_sick', label: 'Sick leave per year', type: 'number', step: '0.5' },
  { name: 'pf_enabled', label: 'Deduct PF (12%, wage cap ₹15,000)', type: 'select', blank: false, options: yesNo },
  { name: 'esi_enabled', label: 'Deduct ESI (0.75%, salary ≤ ₹21,000)', type: 'select', blank: false, options: yesNo },
];

export default async function settingsView(root, _p, _q, alive) {
  const { settings } = await api.get('settings');
  if (!alive()) return;
  const values = {
    ...settings, default_gst_rate: String(Number(settings.default_gst_rate)),
    pf_enabled: String(!!settings.pf_enabled), esi_enabled: String(!!settings.esi_enabled), auto_reminders: String(settings.auto_reminders !== false),
  };
  root.innerHTML = `
    ${pageHead('Company settings', 'Used on invoices, payslips, payroll and reminders')}
    <form class="panel" id="sform" novalidate>
      ${formHtml(FIELDS, values)}
      <p class="muted small mt">PF / ESI / TDS here are simplified employee-share calculations. Per-employee TDS % and PF/ESI opt-outs are on each employee. Please confirm rates with your CA.</p>
      <div class="form-actions"><button class="btn btn-primary" type="submit"><i class="fas fa-floppy-disk"></i> Save settings</button></div>
    </form>
    <section class="panel">
      <div class="panel-head"><h2>Backup</h2></div>
      <p class="muted">Download every ERP record (employees, attendance, payroll, invoices, expenses…) as one JSON file. Keep a copy every month.</p>
      <div class="page-actions mt"><button class="btn btn-ghost" id="backup"><i class="fas fa-download"></i> Download full backup</button></div>
    </section>`;
  const form = root.querySelector('#sform');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = readForm(form, FIELDS);
    if (!v.company_name || !v.invoice_prefix) { toast('Company name and invoice prefix are required.', 'err'); return; }
    v.state = STATES.find(([c]) => c === v.state_code)?.[1] || null;
    if (v.gstin) v.gstin = v.gstin.toUpperCase();
    v.invoice_prefix = v.invoice_prefix.replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || 'UXN';
    v.quote_prefix = (v.quote_prefix || 'QT').replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || 'QT';
    ['pf_enabled', 'esi_enabled', 'auto_reminders'].forEach((k) => { v[k] = v[k] === 'true'; });
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try { const r = await api.put('settings', null, v); toast(r.message); } catch (err) { toastErr(err); }
    finally { btn.disabled = false; }
  });
  root.querySelector('#backup').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try {
      const { backup } = await api.get('backup');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      a.download = `uxonic-erp-backup-${backup.exported_at.slice(0, 10)}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      const count = Object.values(backup.tables).reduce((t, rows) => t + rows.length, 0);
      toast(`Backup downloaded: ${count} records.`);
    } catch (err) { toastErr(err); } finally { b.disabled = false; }
  });
}
