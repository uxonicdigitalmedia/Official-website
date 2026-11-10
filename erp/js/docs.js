// Printable documents shared by the ERP and both portals
import { esc, money, fdate, fmonth, num, badge } from './core.js';
import { amountInWords, round2 } from './calc.js';

const brand = (s) => `
  <div class="doc-brand"><span class="brand-chip lg"><img src="/images/nav-logo-sm.png" alt=""></span>
    <div><h2>${esc(s.company_name)}</h2>
      ${s.address ? `<p class="pre">${esc(s.address)}</p>` : ''}
      <p>${[s.email, s.phone, s.website].filter(Boolean).map(esc).join(' · ')}</p>
      ${s.gstin ? `<p><b>GSTIN:</b> ${esc(s.gstin)}</p>` : ''}</div></div>`;

/** kind: 'invoice' | 'quote' */
export function salesDoc(kind, doc, items, s) {
  const c = doc.erp_clients || {};
  const isQuote = kind === 'quote';
  const balance = isQuote ? 0 : round2(Number(doc.total) - Number(doc.amount_paid || 0));
  const title = isQuote ? 'QUOTATION' : doc.tax_type === 'none' ? 'INVOICE' : 'TAX INVOICE';
  return `
    <article class="doc invoice">
      <header class="doc-head">${brand(s)}
        <div class="doc-title"><h3>${title}</h3>
          <p><b>${esc(isQuote ? doc.quote_no : doc.invoice_no)}</b></p><p>Date: ${fdate(doc.issue_date)}</p>
          ${isQuote ? (doc.valid_until ? `<p>Valid until: ${fdate(doc.valid_until)}</p>` : '') : (doc.due_date ? `<p>Due: ${fdate(doc.due_date)}</p>` : '')}</div>
      </header>
      <div class="doc-parties">
        <div><span>${isQuote ? 'Prepared for' : 'Bill to'}</span><b>${esc(c.company || c.name)}</b>${c.company ? `<p>${esc(c.name)}</p>` : ''}
          ${c.address ? `<p class="pre">${esc(c.address)}</p>` : ''}
          ${c.gstin ? `<p><b>GSTIN:</b> ${esc(c.gstin)}</p>` : ''}
          ${c.state ? `<p>Place of supply: ${esc(c.state)} (${esc(c.state_code)})</p>` : ''}
          <p>${[c.email, c.phone].filter(Boolean).map(esc).join(' · ')}</p></div>
        ${doc.erp_products ? `<div><span>Project</span><b>${esc(doc.erp_products.name)}</b></div>` : ''}
      </div>
      <table class="doc-table lines">
        <thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
        <tbody>${items.map((it) => `<tr><td>${it.position}</td><td>${esc(it.description)}</td><td>${esc(it.hsn_sac || '')}</td><td class="r">${Number(it.quantity)}</td><td class="r">${money(it.rate)}</td><td class="r">${money(it.amount)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="doc-sum">
        <div class="doc-words"><span>Amount in words</span><b>${amountInWords(doc.total)}</b>
          ${!isQuote && (s.bank_account || s.upi_id) ? `<div class="bank"><span>Payment details</span>
            ${s.bank_name ? `<p>${esc(s.bank_name)}</p>` : ''}${s.bank_account ? `<p>A/c: <b>${esc(s.bank_account)}</b></p>` : ''}
            ${s.bank_ifsc ? `<p>IFSC: <b>${esc(s.bank_ifsc)}</b></p>` : ''}${s.upi_id ? `<p>UPI: <b>${esc(s.upi_id)}</b></p>` : ''}</div>` : ''}
        </div>
        <div class="doc-totals">
          <div><span>Subtotal</span><b>${money(doc.subtotal)}</b></div>
          ${Number(doc.discount) ? `<div><span>Discount</span><b>− ${money(doc.discount)}</b></div><div><span>Taxable value</span><b>${money(doc.taxable)}</b></div>` : ''}
          ${doc.tax_type === 'cgst_sgst' ? `<div><span>CGST ${Number(doc.gst_rate) / 2}%</span><b>${money(doc.cgst)}</b></div><div><span>SGST ${Number(doc.gst_rate) / 2}%</span><b>${money(doc.sgst)}</b></div>` : ''}
          ${doc.tax_type === 'igst' ? `<div><span>IGST ${Number(doc.gst_rate)}%</span><b>${money(doc.igst)}</b></div>` : ''}
          <div class="grand"><span>Total</span><b>${money(doc.total)}</b></div>
          ${!isQuote && Number(doc.amount_paid) ? `<div><span>Received</span><b>− ${money(doc.amount_paid)}</b></div><div class="grand"><span>Balance due</span><b>${money(balance)}</b></div>` : ''}
        </div>
      </div>
      ${doc.notes ? `<p class="doc-note pre">${esc(doc.notes)}</p>` : ''}
      <footer class="doc-foot"><span>${isQuote ? 'Prices valid until the date shown above.' : 'Thank you for your business.'}</span><span>For ${esc(s.company_name)} · Authorised signatory</span></footer>
    </article>`;
}

export function payslipDoc(p, s) {
  const e = p.erp_employees || {};
  const gross = round2(Number(p.earned) + Number(p.allowances) + Number(p.bonus));
  const ded = [
    ['Provident Fund (PF)', p.pf], ['ESI', p.esi], ['TDS', p.tds], ['Advance recovery', p.advance_deduction], ['Other deductions', p.deductions],
  ].filter(([, v]) => Number(v));
  const totalDed = round2(ded.reduce((t, [, v]) => t + Number(v), 0));
  return `
    <article class="doc">
      <header class="doc-head">${brand(s)}
        <div class="doc-title"><h3>PAYSLIP</h3><p>${fmonth(p.month)}</p>${badge(p.status)}</div>
      </header>
      <div class="doc-grid">
        <div><span>Employee</span><b>${esc(e.full_name)}</b></div>
        <div><span>Employee code</span><b>${esc(e.emp_code)}</b></div>
        <div><span>Designation</span><b>${esc(e.designation || '—')}</b></div>
        <div><span>Department</span><b>${esc(e.department || '—')}</b></div>
        <div><span>PAN</span><b>${esc(e.pan || '—')}</b></div>
        <div><span>Bank account</span><b>${esc(e.bank_account || '—')} ${e.bank_ifsc ? '· ' + esc(e.bank_ifsc) : ''}</b></div>
        <div><span>Working days</span><b>${num(p.working_days)}</b></div>
        <div><span>Paid days</span><b>${num(p.paid_days)}</b></div>
        <div><span>Present / Half / Leave / Absent</span><b>${num(p.present_days)} / ${num(p.half_days)} / ${num(p.leave_days)} / ${num(p.absent_days)}</b></div>
      </div>
      <div class="doc-cols">
        <table class="doc-table"><thead><tr><th>Earnings</th><th class="r">Amount</th></tr></thead><tbody>
          <tr><td>Salary (${money(p.monthly_salary)} × ${num(p.paid_days)}/${num(p.working_days)} days)</td><td class="r">${money(p.earned)}</td></tr>
          <tr><td>Allowances</td><td class="r">${money(p.allowances)}</td></tr>
          <tr><td>Bonus / incentive</td><td class="r">${money(p.bonus)}</td></tr>
        </tbody><tfoot><tr><td>Gross earnings</td><td class="r">${money(gross)}</td></tr></tfoot></table>
        <table class="doc-table"><thead><tr><th>Deductions</th><th class="r">Amount</th></tr></thead><tbody>
          ${ded.length ? ded.map(([l, v]) => `<tr><td>${l}</td><td class="r">${money(v)}</td></tr>`).join('') : '<tr><td>None</td><td class="r">₹0.00</td></tr>'}
        </tbody><tfoot><tr><td>Total deductions</td><td class="r">${money(totalDed)}</td></tr></tfoot></table>
      </div>
      <div class="doc-total"><span>Net pay</span><b>${money(p.net_pay)}</b><small>${amountInWords(p.net_pay)}</small></div>
      ${p.notes ? `<p class="doc-note">${esc(p.notes)}</p>` : ''}
      <footer class="doc-foot"><span>${p.status === 'paid' ? `Paid on ${fdate(p.paid_on)}${p.payment_mode ? ' via ' + esc(p.payment_mode) : ''}` : 'Not yet paid'}</span><span>This is a computer-generated payslip.</span></footer>
    </article>`;
}
