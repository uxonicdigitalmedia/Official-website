// Clients, invoices, payments, quotations, recurring invoices, expenses, emails
import {
  C, must, clean, bad, conflict, notFound, idOf, today, getSettings, invoiceMoney, methodNotAllowed, HttpError,
} from './core.js';
import { sendEmail } from '../email.js';

// ================================================================ CLIENTS
const CLIENT_SPEC = {
  name: 'text!', company: 'text', email: 'text', phone: 'text', gstin: 'text', address: 'text',
  state: 'text', state_code: 'text', notes: 'text', portal_enabled: 'bool',
};

export async function clients({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) {
      const id = idOf(q);
      const [client, invs, prods, quotes] = await Promise.all([
        sb.from('erp_clients').select('*').eq('id', id).single().then(must),
        sb.from('erp_invoices').select('id, invoice_no, issue_date, due_date, total, amount_paid, status').eq('client_id', id).order('issue_date', { ascending: false }).then(must),
        sb.from('erp_products').select('id, name, kind, status').eq('client_id', id).then(must),
        sb.from('erp_quotes').select('id, quote_no, issue_date, total, status').eq('client_id', id).order('issue_date', { ascending: false }).then(must),
      ]);
      invs.forEach((i) => { i.effective_status = C.invoiceStatus(i, today()); });
      return { client, invoices: invs, products: prods, quotes, money: invoiceMoney(invs) };
    }
    const [list, invs] = await Promise.all([
      sb.from('erp_clients').select('*').order('name').then(must),
      sb.from('erp_invoices').select('client_id, total, amount_paid, status').then(must),
    ]);
    list.forEach((c) => { Object.assign(c, invoiceMoney(invs.filter((i) => i.client_id === c.id))); });
    return { clients: list };
  }
  if (method === 'POST') {
    const row = clean(body, CLIENT_SPEC);
    if (row.email) row.email = row.email.toLowerCase();
    const c = must(await sb.from('erp_clients').insert(row).select('*').single());
    return { client: c, message: 'Client added.' };
  }
  if (method === 'PUT') {
    const row = clean(body, CLIENT_SPEC, { partial: true });
    if (row.email) row.email = row.email.toLowerCase();
    const c = must(await sb.from('erp_clients').update(row).eq('id', idOf(q)).select('*').single());
    return { client: c, message: 'Client updated.' };
  }
  if (method === 'DELETE') {
    const id = idOf(q);
    const qs = must(await sb.from('erp_quotes').select('id').eq('client_id', id).limit(1));
    if (qs.length) throw conflict('This client has quotations. Delete them first.');
    must(await sb.from('erp_clients').delete().eq('id', id));
    return { message: 'Client deleted.' };
  }
  throw methodNotAllowed();
}

// ================================================================ document numbering + totals (invoice & quote)
async function nextNumber(sb, table, col, prefix, issueDate) {
  const base = `${prefix}/${C.financialYear(issueDate)}/`;
  const rows = must(await sb.from(table).select(col).like(col, base + '%'));
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r[col]).slice(base.length), 10) || 0), 0);
  return base + String(max + 1).padStart(4, '0');
}

/** Validate & total a document body. dateKey = 'due_date' (invoice) | 'valid_until' (quote) */
export async function buildDoc(sb, body, s, dateKey = 'due_date') {
  const head = clean(body, {
    client_id: 'int!', product_id: 'int', issue_date: 'date', [dateKey]: 'date',
    gst_rate: 'num', discount: 'num', notes: 'text',
  });
  head.issue_date = head.issue_date || today();
  if (head[dateKey] && head[dateKey] < head.issue_date) throw bad(`${dateKey === 'due_date' ? 'Due date' : 'Valid-until date'} cannot be before the issue date.`);
  const client = must(await sb.from('erp_clients').select('id, state_code').eq('id', head.client_id).single());
  const gstRate = head.gst_rate ?? s.default_gst_rate;
  const taxType = body.tax_mode === 'none' ? 'none' : C.taxTypeFor(s.state_code, client.state_code);
  const calc = C.computeInvoice({ items: Array.isArray(body.items) ? body.items : [], gstRate, discount: head.discount || 0, taxType });
  if (!calc.items.length) throw bad('Add at least one line item.');
  if (calc.total <= 0) throw bad('Total must be more than zero.');
  const { items: lines, ...totals } = calc;
  return { head: { ...head, ...totals }, lines };
}

/** Insert an invoice with a fresh number (retries on a number clash) */
export async function createInvoice(sb, s, head, lines, extra = {}) {
  let inv = null;
  for (let attempt = 0; attempt < 4 && !inv; attempt++) {
    const invoice_no = await nextNumber(sb, 'erp_invoices', 'invoice_no', s.invoice_prefix || 'UXN', head.issue_date);
    const r = await sb.from('erp_invoices').insert({ ...head, ...extra, invoice_no }).select('*').single();
    if (r.error && r.error.code === '23505') continue;
    inv = must(r);
  }
  if (!inv) throw conflict('Could not allocate an invoice number, please retry.');
  const ins = await sb.from('erp_invoice_items').insert(lines.map((l) => ({ ...l, invoice_id: inv.id })));
  if (ins.error) { await sb.from('erp_invoices').delete().eq('id', inv.id); must(ins); }
  return inv;
}

async function refreshPaid(sb, invoiceId) {
  const inv = must(await sb.from('erp_invoices').select('id, total, status').eq('id', invoiceId).single());
  const pays = must(await sb.from('erp_payments').select('amount').eq('invoice_id', invoiceId));
  const paid = C.round2(pays.reduce((s, p) => s + Number(p.amount), 0));
  const status = C.statusFromPayments(Number(inv.total), paid, inv.status);
  must(await sb.from('erp_invoices').update({ amount_paid: paid, status }).eq('id', invoiceId));
  return { paid, status };
}

// ================================================================ EMAIL documents
const escH = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const portalLink = (s) => String(s.portal_url || 'https://www.uxonicdigital.com').replace(/\/$/, '') + '/erp/client';

export function documentEmailHtml({ kind, doc, items, client, s, intro }) {
  const no = kind === 'quote' ? doc.quote_no : doc.invoice_no;
  const rows = items.map((it) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escH(it.description)}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${Number(it.quantity)}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${C.inr(it.rate)}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${C.inr(it.amount)}</td></tr>`).join('');
  const line = (l, v, b) => `<tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#555">${l}</td><td style="padding:6px 8px;text-align:right;${b ? 'font-weight:700;font-size:16px' : ''}">${v}</td></tr>`;
  const taxes = doc.tax_type === 'cgst_sgst'
    ? line(`CGST ${Number(doc.gst_rate) / 2}%`, C.inr(doc.cgst)) + line(`SGST ${Number(doc.gst_rate) / 2}%`, C.inr(doc.sgst))
    : doc.tax_type === 'igst' ? line(`IGST ${Number(doc.gst_rate)}%`, C.inr(doc.igst)) : '';
  const balance = kind === 'invoice' ? C.round2(Number(doc.total) - Number(doc.amount_paid || 0)) : null;
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;color:#111114">
    <div style="padding:24px;border:1px solid #E8E7E1;border-radius:16px">
      <h2 style="margin:0">${escH(s.company_name)}</h2>
      <p style="color:#8C8C95;margin:4px 0 20px">${kind === 'quote' ? 'Quotation' : 'Invoice'} <b style="color:#111114">${escH(no)}</b> · ${escH(doc.issue_date)}${doc.due_date ? ' · due ' + escH(doc.due_date) : ''}${doc.valid_until ? ' · valid until ' + escH(doc.valid_until) : ''}</p>
      <p>Hi ${escH(client.name)},</p><p>${intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr style="background:#FAFAF7"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px;text-align:right">Qty</th><th style="padding:8px;text-align:right">Rate</th><th style="padding:8px;text-align:right">Amount</th></tr>
        ${rows}${line('Subtotal', C.inr(doc.subtotal))}${Number(doc.discount) ? line('Discount', '− ' + C.inr(doc.discount)) : ''}${taxes}
        ${line('Total', C.inr(doc.total), true)}${balance != null && balance !== Number(doc.total) ? line('Balance due', C.inr(balance), true) : ''}
      </table>
      ${kind === 'invoice' && (s.bank_account || s.upi_id) ? `<p style="background:#F0EBFF;padding:12px 14px;border-radius:10px;font-size:13px">Pay to: ${[s.bank_name, s.bank_account && 'A/c ' + s.bank_account, s.bank_ifsc && 'IFSC ' + s.bank_ifsc, s.upi_id && 'UPI ' + s.upi_id].filter(Boolean).map(escH).join(' · ')}</p>` : ''}
      ${client.portal_enabled !== false && client.email ? `<p><a href="${portalLink(s)}" style="display:inline-block;background:#E4FF1A;color:#111114;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">View in client portal</a></p>` : ''}
      <p style="color:#8C8C95;font-size:12px">${escH(s.company_name)} · ${escH(s.email || '')} · ${escH(s.phone || '')}</p>
    </div></div>`;
}

export async function emailInvoice(sb, id, { reminder = false } = {}) {
  const s = await getSettings(sb);
  const inv = must(await sb.from('erp_invoices').select('*, erp_clients(*)').eq('id', id).single());
  const client = inv.erp_clients;
  if (!client?.email) throw bad('This client has no email address. Add one in Clients first.');
  if (inv.status === 'cancelled') throw conflict('Cancelled invoices cannot be emailed.');
  const items = must(await sb.from('erp_invoice_items').select('*').eq('invoice_id', id).order('position'));
  const balance = C.round2(Number(inv.total) - Number(inv.amount_paid));
  const intro = reminder
    ? `This is a friendly reminder that <b>${C.inr(balance)}</b> is pending on invoice ${escH(inv.invoice_no)}${inv.due_date ? ` (due ${escH(inv.due_date)})` : ''}.`
    : `Please find your invoice below. Total: <b>${C.inr(inv.total)}</b>.`;
  const r = await sendEmail({
    to: client.email,
    subject: reminder ? `Payment reminder: ${inv.invoice_no} (${C.inr(balance)} due)` : `Invoice ${inv.invoice_no} from ${s.company_name}`,
    html: documentEmailHtml({ kind: 'invoice', doc: inv, items, client, s, intro }),
    reply_to: s.email || undefined,
  });
  if (!r.ok) throw new HttpError(502, 'Email could not be sent: ' + r.error);
  const upd = reminder ? { last_reminded_at: new Date().toISOString() } : { sent_at: new Date().toISOString() };
  if (!reminder && inv.status === 'draft') upd.status = 'sent';
  must(await sb.from('erp_invoices').update(upd).eq('id', id));
  return { message: reminder ? `Reminder sent to ${client.email}.` : `Invoice emailed to ${client.email}.` };
}

// ================================================================ INVOICES
export async function invoices({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) {
      const id = idOf(q);
      const [invoice, items, payments, s] = await Promise.all([
        sb.from('erp_invoices').select('*, erp_clients(*), erp_products(id, name)').eq('id', id).single().then(must),
        sb.from('erp_invoice_items').select('*').eq('invoice_id', id).order('position').then(must),
        sb.from('erp_payments').select('*').eq('invoice_id', id).order('paid_on').then(must),
        getSettings(sb),
      ]);
      invoice.effective_status = C.invoiceStatus(invoice, today());
      return { invoice, items, payments, settings: s, portal_url: portalLink(s) };
    }
    let query = sb.from('erp_invoices').select('id, invoice_no, client_id, product_id, issue_date, due_date, total, amount_paid, status, erp_clients(name, company), erp_products(name)')
      .order('issue_date', { ascending: false }).order('id', { ascending: false });
    if (q.client_id) query = query.eq('client_id', parseInt(q.client_id, 10));
    if (q.product_id) query = query.eq('product_id', parseInt(q.product_id, 10));
    const list = must(await query);
    list.forEach((i) => { i.effective_status = C.invoiceStatus(i, today()); });
    return { invoices: q.status ? list.filter((i) => i.effective_status === q.status) : list };
  }

  if (method === 'POST') {
    if (q.action === 'email' || q.action === 'remind') return emailInvoice(sb, idOf(q), { reminder: q.action === 'remind' });
    const s = await getSettings(sb);
    const { head, lines } = await buildDoc(sb, body, s, 'due_date');
    head.status = body.status === 'sent' ? 'sent' : 'draft';
    const inv = await createInvoice(sb, s, head, lines);
    let message = `Invoice ${inv.invoice_no} created.`;
    if (body.send_email) {
      try { message += ' ' + (await emailInvoice(sb, inv.id)).message; } catch (e) { message += ' Email not sent: ' + e.message; }
    }
    return { invoice: inv, message };
  }

  if (method === 'PUT') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_invoices').select('*').eq('id', id).single());
    if (body && body.status && !body.items) {
      const status = clean(body, { status: 'enum:draft|sent|cancelled' }).status;
      if (status === 'cancelled' && Number(cur.amount_paid) > 0) throw conflict('Remove payments before cancelling this invoice.');
      if (cur.status === 'cancelled' && status !== 'draft') throw conflict('Re-open a cancelled invoice as draft first.');
      const next = status === 'cancelled' || status === 'draft' ? status : C.statusFromPayments(Number(cur.total), Number(cur.amount_paid), 'sent');
      must(await sb.from('erp_invoices').update({ status: next }).eq('id', id));
      return { message: 'Invoice marked ' + next + '.' };
    }
    if (['paid', 'cancelled'].includes(cur.status)) throw conflict(`A ${cur.status} invoice cannot be edited.`);
    const s = await getSettings(sb);
    const { head, lines } = await buildDoc(sb, body, s, 'due_date');
    if (head.total < Number(cur.amount_paid)) throw bad('New total is less than the amount already received.');
    head.status = C.statusFromPayments(head.total, Number(cur.amount_paid), cur.status);
    must(await sb.from('erp_invoices').update(head).eq('id', id));
    must(await sb.from('erp_invoice_items').delete().eq('invoice_id', id));
    must(await sb.from('erp_invoice_items').insert(lines.map((l) => ({ ...l, invoice_id: id }))));
    return { message: 'Invoice updated.' };
  }

  if (method === 'DELETE') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_invoices').select('amount_paid').eq('id', id).single());
    if (Number(cur.amount_paid) > 0) throw conflict('This invoice has payments. Cancel it instead of deleting.');
    await sb.from('erp_quotes').update({ invoice_id: null, status: 'accepted' }).eq('invoice_id', id);
    must(await sb.from('erp_invoices').delete().eq('id', id));
    return { message: 'Invoice deleted.' };
  }
  throw methodNotAllowed();
}

export async function payments({ sb, method, q, body }) {
  if (method === 'POST') {
    const row = clean(body, { invoice_id: 'int!', amount: 'num!', paid_on: 'date', mode: 'text', reference: 'text' });
    if (row.amount <= 0) throw bad('Amount must be more than zero.');
    const inv = must(await sb.from('erp_invoices').select('total, amount_paid, status').eq('id', row.invoice_id).single());
    if (['cancelled', 'draft'].includes(inv.status)) throw conflict(`Mark the invoice as sent before recording payments (it is ${inv.status}).`);
    const balance = C.round2(Number(inv.total) - Number(inv.amount_paid));
    if (row.amount > balance + 0.005) throw bad(`Amount is more than the balance due (${C.inr(balance)}).`);
    row.paid_on = row.paid_on || today();
    must(await sb.from('erp_payments').insert(row));
    return { ...(await refreshPaid(sb, row.invoice_id)), message: 'Payment recorded.' };
  }
  if (method === 'DELETE') {
    const id = idOf(q);
    const p = must(await sb.from('erp_payments').select('invoice_id').eq('id', id).single());
    must(await sb.from('erp_payments').delete().eq('id', id));
    return { ...(await refreshPaid(sb, p.invoice_id)), message: 'Payment removed.' };
  }
  throw methodNotAllowed();
}

// ================================================================ QUOTATIONS
export async function convertQuote(sb, id) {
  const quote = must(await sb.from('erp_quotes').select('*').eq('id', id).single());
  if (quote.status === 'converted' && quote.invoice_id) throw conflict('Already converted to an invoice.');
  if (quote.status === 'rejected') throw conflict('This quotation was rejected.');
  const items = must(await sb.from('erp_quote_items').select('*').eq('quote_id', id).order('position'));
  const s = await getSettings(sb);
  const issue = today();
  const head = {
    client_id: quote.client_id, product_id: quote.product_id, issue_date: issue, due_date: C.addDays(issue, 15),
    gst_rate: quote.gst_rate, tax_type: quote.tax_type, subtotal: quote.subtotal, discount: quote.discount, taxable: quote.taxable,
    cgst: quote.cgst, sgst: quote.sgst, igst: quote.igst, total: quote.total, notes: quote.notes, status: 'draft',
  };
  const lines = items.map(({ position, description, hsn_sac, quantity, rate, amount }) => ({ position, description, hsn_sac, quantity, rate, amount }));
  const inv = await createInvoice(sb, s, head, lines, { quote_id: id });
  must(await sb.from('erp_quotes').update({ status: 'converted', invoice_id: inv.id }).eq('id', id));
  return { invoice: inv, message: `Converted to invoice ${inv.invoice_no}.` };
}

export async function quotes({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) {
      const id = idOf(q);
      const [quote, items, s] = await Promise.all([
        sb.from('erp_quotes').select('*, erp_clients(*), erp_products(id, name), erp_invoices(id, invoice_no)').eq('id', id).single().then(must),
        sb.from('erp_quote_items').select('*').eq('quote_id', id).order('position').then(must),
        getSettings(sb),
      ]);
      quote.expired = quote.status === 'sent' && quote.valid_until && quote.valid_until < today();
      return { quote, items, settings: s };
    }
    const list = must(await sb.from('erp_quotes').select('id, quote_no, client_id, issue_date, valid_until, total, status, invoice_id, erp_clients(name, company), erp_products(name)')
      .order('issue_date', { ascending: false }).order('id', { ascending: false }));
    list.forEach((x) => { x.expired = x.status === 'sent' && x.valid_until && x.valid_until < today(); });
    return { quotes: q.status ? list.filter((x) => x.status === q.status) : list };
  }
  if (method === 'POST') {
    if (q.action === 'convert') return convertQuote(sb, idOf(q));
    if (q.action === 'email') {
      const id = idOf(q);
      const s = await getSettings(sb);
      const quote = must(await sb.from('erp_quotes').select('*, erp_clients(*)').eq('id', id).single());
      if (!quote.erp_clients?.email) throw bad('This client has no email address.');
      const items = must(await sb.from('erp_quote_items').select('*').eq('quote_id', id).order('position'));
      const r = await sendEmail({
        to: quote.erp_clients.email, subject: `Quotation ${quote.quote_no} from ${s.company_name}`, reply_to: s.email || undefined,
        html: documentEmailHtml({ kind: 'quote', doc: quote, items, client: quote.erp_clients, s, intro: `Here is our quotation for your review. You can accept it from the client portal or just reply to this email.` }),
      });
      if (!r.ok) throw new HttpError(502, 'Email could not be sent: ' + r.error);
      if (quote.status === 'draft') must(await sb.from('erp_quotes').update({ status: 'sent' }).eq('id', id));
      return { message: `Quotation emailed to ${quote.erp_clients.email}.` };
    }
    const s = await getSettings(sb);
    const { head, lines } = await buildDoc(sb, body, s, 'valid_until');
    if (!head.valid_until) head.valid_until = C.addDays(head.issue_date, 30);
    head.status = body.status === 'sent' ? 'sent' : 'draft';
    let quote = null;
    for (let a = 0; a < 4 && !quote; a++) {
      const quote_no = await nextNumber(sb, 'erp_quotes', 'quote_no', s.quote_prefix || 'QT', head.issue_date);
      const r = await sb.from('erp_quotes').insert({ ...head, quote_no }).select('*').single();
      if (r.error && r.error.code === '23505') continue;
      quote = must(r);
    }
    if (!quote) throw conflict('Could not allocate a quotation number.');
    must(await sb.from('erp_quote_items').insert(lines.map((l) => ({ ...l, quote_id: quote.id }))));
    return { quote, message: `Quotation ${quote.quote_no} created.` };
  }
  if (method === 'PUT') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_quotes').select('*').eq('id', id).single());
    if (body && body.status && !body.items) {
      const status = clean(body, { status: 'enum:draft|sent|accepted|rejected' }).status;
      if (cur.status === 'converted') throw conflict('This quotation is already converted to an invoice.');
      must(await sb.from('erp_quotes').update({ status }).eq('id', id));
      return { message: 'Quotation marked ' + status + '.' };
    }
    if (cur.status === 'converted') throw conflict('A converted quotation cannot be edited.');
    const s = await getSettings(sb);
    const { head, lines } = await buildDoc(sb, body, s, 'valid_until');
    must(await sb.from('erp_quotes').update(head).eq('id', id));
    must(await sb.from('erp_quote_items').delete().eq('quote_id', id));
    must(await sb.from('erp_quote_items').insert(lines.map((l) => ({ ...l, quote_id: id }))));
    return { message: 'Quotation updated.' };
  }
  if (method === 'DELETE') {
    const id = idOf(q);
    const cur = must(await sb.from('erp_quotes').select('status').eq('id', id).single());
    if (cur.status === 'converted') throw conflict('Converted quotations are kept for records.');
    must(await sb.from('erp_quotes').delete().eq('id', id));
    return { message: 'Quotation deleted.' };
  }
  throw methodNotAllowed();
}

// ================================================================ RECURRING INVOICES
const REC_SPEC = {
  title: 'text!', client_id: 'int!', product_id: 'int', gst_rate: 'num', tax_mode: 'enum:auto|none', discount: 'num',
  notes: 'text', interval_months: 'int', due_days: 'int', next_date: 'date!', end_date: 'date', active: 'bool', auto_send: 'bool',
};

function cleanItems(items) {
  const calc = C.computeInvoice({ items: Array.isArray(items) ? items : [], gstRate: 0 });
  if (!calc.items.length) throw bad('Add at least one line item.');
  return calc.items.map(({ description, hsn_sac, quantity, rate }) => ({ description, hsn_sac, quantity, rate }));
}

/** Create the invoice for one recurring template and move next_date forward */
export async function runRecurringOne(sb, rec, s) {
  const issue = rec.next_date;
  const { head, lines } = await buildDoc(sb, {
    client_id: rec.client_id, product_id: rec.product_id, issue_date: issue, due_date: C.addDays(issue, rec.due_days ?? 15),
    gst_rate: rec.gst_rate, tax_mode: rec.tax_mode, discount: rec.discount, notes: rec.notes, items: rec.items,
  }, s, 'due_date');
  head.status = rec.auto_send ? 'sent' : 'draft';
  const inv = await createInvoice(sb, s, head, lines, { recurring_id: rec.id });
  const next = C.addMonths(rec.next_date, rec.interval_months || 1);
  const stillActive = !rec.end_date || next <= rec.end_date;
  must(await sb.from('erp_recurring').update({ next_date: next, last_invoice_id: inv.id, active: stillActive }).eq('id', rec.id));
  let emailed = false;
  if (rec.auto_send) { try { await emailInvoice(sb, inv.id); emailed = true; } catch (e) { console.error('[recurring] email failed', e.message); } }
  return { invoice: inv, emailed };
}

export async function runDueRecurring(sb, day = today()) {
  const s = await getSettings(sb);
  const due = must(await sb.from('erp_recurring').select('*').eq('active', true).lte('next_date', day));
  const created = [];
  for (const rec of due) {
    let r = rec;
    for (let guard = 0; guard < 12 && r.active && r.next_date <= day && (!r.end_date || r.next_date <= r.end_date); guard++) {
      const out = await runRecurringOne(sb, r, s);
      created.push(out.invoice.invoice_no);
      r = must(await sb.from('erp_recurring').select('*').eq('id', rec.id).single());
    }
  }
  return created;
}

export async function recurring({ sb, method, q, body }) {
  if (method === 'GET') {
    if (q.id) {
      const rec = must(await sb.from('erp_recurring').select('*, erp_clients(name, company), erp_products(name)').eq('id', idOf(q)).single());
      const invs = must(await sb.from('erp_invoices').select('id, invoice_no, issue_date, total, status').eq('recurring_id', rec.id).order('issue_date', { ascending: false }));
      return { recurring: rec, invoices: invs };
    }
    return { recurring: must(await sb.from('erp_recurring').select('*, erp_clients(name, company), erp_products(name)').order('active', { ascending: false }).order('next_date')) };
  }
  if (method === 'POST') {
    if (q.action === 'run') {
      const s = await getSettings(sb);
      const rec = must(await sb.from('erp_recurring').select('*').eq('id', idOf(q)).single());
      if (!rec.active) throw conflict('This schedule is paused.');
      const out = await runRecurringOne(sb, rec, s);
      return { invoice: out.invoice, message: `Invoice ${out.invoice.invoice_no} created${out.emailed ? ' and emailed' : ''}.` };
    }
    const row = clean(body, REC_SPEC);
    row.items = cleanItems(body.items);
    row.interval_months = Math.min(12, Math.max(1, row.interval_months || 1));
    if (row.active === undefined) row.active = true;
    const rec = must(await sb.from('erp_recurring').insert(row).select('*').single());
    return { recurring: rec, message: 'Recurring invoice scheduled.' };
  }
  if (method === 'PUT') {
    const row = clean(body, REC_SPEC, { partial: true });
    if (body.items) row.items = cleanItems(body.items);
    if (row.interval_months) row.interval_months = Math.min(12, Math.max(1, row.interval_months));
    must(await sb.from('erp_recurring').update(row).eq('id', idOf(q)));
    return { message: 'Schedule updated.' };
  }
  if (method === 'DELETE') {
    must(await sb.from('erp_recurring').delete().eq('id', idOf(q)));
    return { message: 'Schedule deleted. Invoices already created are kept.' };
  }
  throw methodNotAllowed();
}

// ================================================================ OVERDUE REMINDERS (cron)
export async function sendDueReminders(sb, day = today()) {
  const s = await getSettings(sb);
  if (!s.auto_reminders) return [];
  const every = Math.max(1, Number(s.reminder_every_days) || 7);
  const open = must(await sb.from('erp_invoices').select('id, invoice_no, due_date, status, last_reminded_at, erp_clients(email)')
    .in('status', ['sent', 'partially-paid']).lt('due_date', day));
  const sent = [];
  for (const inv of open) {
    if (!inv.erp_clients?.email) continue;
    if (inv.last_reminded_at && (Date.now() - new Date(inv.last_reminded_at).getTime()) < every * 86400_000 - 3600_000) continue;
    try { await emailInvoice(sb, inv.id, { reminder: true }); sent.push(inv.invoice_no); } catch (e) { console.error('[reminder]', inv.invoice_no, e.message); }
  }
  return sent;
}

// ================================================================ EXPENSES
export const EXPENSE_CATEGORIES = ['Rent', 'Software & subscriptions', 'Hosting & domains', 'Marketing & ads', 'Travel',
  'Equipment', 'Utilities & internet', 'Professional fees', 'Office supplies', 'Food & refreshments', 'Freelancers', 'Taxes & fees', 'Other'];
const EXP_SPEC = {
  date: 'date!', category: 'text!', vendor: 'text', description: 'text', amount: 'num!', gst_amount: 'num',
  payment_mode: 'text', reference: 'text', product_id: 'int',
};

export async function expenses({ sb, method, q, body }) {
  if (method === 'GET') {
    let query = sb.from('erp_expenses').select('*, erp_products(name)').order('date', { ascending: false }).order('id', { ascending: false });
    if (q.month) { const r = C.monthRange(q.month); query = query.gte('date', r.first).lte('date', r.last); }
    if (q.category) query = query.eq('category', q.category);
    if (q.product_id) query = query.eq('product_id', parseInt(q.product_id, 10));
    const list = must(await query.limit(3000));
    const byCat = {};
    list.forEach((x) => { byCat[x.category] = C.round2((byCat[x.category] || 0) + Number(x.amount)); });
    return {
      expenses: list, categories: EXPENSE_CATEGORIES,
      totals: {
        amount: C.round2(list.reduce((t, x) => t + Number(x.amount), 0)),
        gst: C.round2(list.reduce((t, x) => t + Number(x.gst_amount), 0)),
        by_category: Object.entries(byCat).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      },
    };
  }
  if (method === 'POST' || method === 'PUT') {
    const row = clean(body, EXP_SPEC, { partial: method === 'PUT' });
    if ('amount' in row && !(row.amount > 0)) throw bad('Amount must be more than zero.');
    if (row.gst_amount == null && method === 'POST') row.gst_amount = 0;
    if (row.gst_amount != null && row.amount != null && row.gst_amount > row.amount) throw bad('GST cannot be more than the total amount.');
    if (method === 'POST') {
      const x = must(await sb.from('erp_expenses').insert(row).select('*').single());
      return { expense: x, message: 'Expense added.' };
    }
    must(await sb.from('erp_expenses').update(row).eq('id', idOf(q)));
    return { message: 'Expense updated.' };
  }
  if (method === 'DELETE') {
    must(await sb.from('erp_expenses').delete().eq('id', idOf(q)));
    return { message: 'Expense deleted.' };
  }
  throw methodNotAllowed();
}

export { notFound };
