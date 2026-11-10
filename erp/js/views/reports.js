import { api, esc, money, fmonth, num, pageHead, empty, downloadCsv } from '../core.js';
import { ymd, parseYmd } from '../calc.js';

const shortMonth = (m) => parseYmd(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
const compact = (n) => {
  const a = Math.abs(n);
  const s = a >= 1e7 ? (a / 1e7).toFixed(1) + 'Cr' : a >= 1e5 ? (a / 1e5).toFixed(1) + 'L' : a >= 1e3 ? (a / 1e3).toFixed(0) + 'k' : String(Math.round(a));
  return (n < 0 ? '−₹' : '₹') + s;
};

/** Money in vs money out per month, with a profit marker */
function pnlChart(series) {
  const W = 760, H = 260, padL = 52, padB = 28, padT = 12;
  const max = Math.max(1, ...series.map((s) => Math.max(s.received, s.expenses + s.salaries)));
  const min = Math.min(0, ...series.map((s) => s.profit));
  const span = max - min;
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / span);
  const step = (W - padL) / series.length;
  const bw = Math.min(26, step / 3);
  const ticks = (min < 0 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).map((t) => min + span * t);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Monthly money in versus money out">
    ${ticks.map((t) => `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="grid-l"/><text x="${padL - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${compact(t)}</text>`).join('')}
    ${min < 0 ? `<line x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="grid-l zero"/><text x="${padL - 8}" y="${y(0) + 4}" class="axis" text-anchor="end">₹0</text>` : ''}
    ${series.map((s, i) => {
      const cx = padL + step * i + step / 2;
      const out = s.expenses + s.salaries;
      return `<g><title>${fmonth(s.month)} — In ${money(s.received)} · Out ${money(out)} (expenses ${money(s.expenses)}, salaries ${money(s.salaries)}) · Profit ${money(s.profit)}</title>
        <rect x="${cx - bw - 1}" y="${y(s.received)}" width="${bw}" height="${Math.max(0, y(0) - y(s.received))}" class="b-in" rx="3"/>
        <rect x="${cx + 1}" y="${y(s.salaries)}" width="${bw}" height="${Math.max(0, y(0) - y(s.salaries))}" class="b-sal" rx="3"/>
        <rect x="${cx + 1}" y="${y(out)}" width="${bw}" height="${Math.max(0, y(s.salaries) - y(out))}" class="b-exp" rx="3"/>
        <circle cx="${cx}" cy="${y(s.profit)}" r="4" class="${s.profit < 0 ? 'p-neg' : 'p-pos'}"/>
        <text x="${cx}" y="${H - 8}" class="axis" text-anchor="middle">${shortMonth(s.month)}</text></g>`;
    }).join('')}
  </svg>
  <div class="legend chart-legend"><span><i class="dot b-in"></i>Money received</span><span><i class="dot b-sal"></i>Salaries</span><span><i class="dot b-exp"></i>Expenses</span><span><i class="dot p-pos"></i>Profit</span></div>`;
}

export async function reportsView(root, _p, query, alive) {
  const to = /^\d{4}-\d{2}$/.test(query.to || '') ? query.to : ymd(new Date()).slice(0, 7);
  const from = /^\d{4}-\d{2}$/.test(query.from || '') ? query.from : (() => { const d = parseYmd(to + '-01'); d.setMonth(d.getMonth() - 11); return ymd(d).slice(0, 7); })();
  const d = await api.get('reports', { from, to });
  if (!alive()) return;
  const t = d.totals;
  const maxClient = Math.max(1, ...d.clients.map((c) => c.received));

  root.innerHTML = `
    ${pageHead('Reports & P&L', `${fmonth(d.from)} – ${fmonth(d.to)} · cash basis (money actually received and spent)`,
      '<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export P&L</button>')}
    <div class="toolbar"><div class="date-nav">
      <label class="muted small" for="from">From</label><input type="month" id="from" value="${d.from}">
      <label class="muted small" for="to">To</label><input type="month" id="to" value="${d.to}">
      <button class="btn btn-ghost btn-sm" data-range="3">3 months</button><button class="btn btn-ghost btn-sm" data-range="12">12 months</button>
    </div></div>
    <div class="stats">
      <div class="stat"><span class="stat-label">Invoiced</span><span class="stat-val">${money(t.invoiced)}</span></div>
      <div class="stat"><span class="stat-label">Received</span><span class="stat-val">${money(t.received)}</span></div>
      <div class="stat"><span class="stat-label">Salaries</span><span class="stat-val">${money(t.salaries)}</span></div>
      <div class="stat"><span class="stat-label">Expenses (excl. GST)</span><span class="stat-val">${money(t.expenses)}</span></div>
      <div class="stat"><span class="stat-label">${t.profit < 0 ? 'Loss' : 'Profit'}</span><span class="stat-val ${t.profit < 0 ? 't-red' : 't-green'}">${money(Math.abs(t.profit))}</span></div>
    </div>
    <section class="panel"><div class="panel-head"><h2>Money in vs money out</h2></div>${pnlChart(d.series)}</section>

    <section class="panel">
      <div class="panel-head"><h2>Month by month</h2></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Month</th><th class="r">Invoiced</th><th class="r">Received</th><th class="r">Salaries</th><th class="r">Expenses</th><th class="r">Profit</th></tr></thead>
        <tbody>${d.series.map((s) => `<tr><td><b>${fmonth(s.month)}</b></td><td class="r">${money(s.invoiced)}</td><td class="r">${money(s.received)}</td><td class="r">${money(s.salaries)}</td><td class="r">${money(s.expenses)}</td><td class="r ${s.profit < 0 ? 't-red' : 't-green'}"><b>${money(s.profit)}</b></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td class="r">${money(t.invoiced)}</td><td class="r">${money(t.received)}</td><td class="r">${money(t.salaries)}</td><td class="r">${money(t.expenses)}</td><td class="r">${money(t.profit)}</td></tr></tfoot>
      </table></div>
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Product / project profit</h2></div>
        ${d.products.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Product</th><th class="r">Days</th><th class="r">Salary cost</th><th class="r">Expenses</th><th class="r">Received</th><th class="r">Profit</th></tr></thead>
          <tbody>${d.products.map((p) => `<tr class="click" data-href="#/products/${p.id}"><td><b>${esc(p.name)}</b></td><td class="r">${num(p.days)}</td><td class="r">${money(p.salary_cost)}</td><td class="r">${money(p.expenses)}</td><td class="r">${money(p.received)}</td><td class="r ${p.profit < 0 ? 't-red' : 't-green'}"><b>${money(p.profit)}</b></td></tr>`).join('')}</tbody>
        </table></div>` : empty('fa-cubes', 'No product activity in this period.')}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Revenue by client</h2></div>
        ${d.clients.length ? `<div class="bars">${d.clients.map((c) => `
          <a class="bar-row" href="#/clients/${c.id}"><span class="bar-name">${esc(c.name)}</span><span class="bar-track"><span class="bar-fill" style="width:${(c.received / maxClient) * 100}%"></span></span><span class="bar-val">${money(c.received)}</span></a>`).join('')}</div>` : empty('fa-handshake', 'No client revenue in this period.')}
      </section>
    </div>
    <div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>Expenses by category</h2><a class="link" href="#/expenses">Expenses <i class="fas fa-arrow-right"></i></a></div>
        ${d.expenses_by_category.length ? `<div class="bars">${(() => { const m = Math.max(...d.expenses_by_category.map((c) => c.amount)); return d.expenses_by_category.map((c) => `
          <div class="bar-row"><span class="bar-name">${esc(c.category)}</span><span class="bar-track"><span class="bar-fill alt" style="width:${(c.amount / m) * 100}%"></span></span><span class="bar-val">${money(c.amount)}</span></div>`).join(''); })()}</div>`
          : empty('fa-receipt', 'No expenses in this period.')}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>Team utilisation</h2></div>
        <p class="muted small" style="margin:-6px 0 12px">Share of worked days logged against a product/project.</p>
        ${d.utilisation.length ? `<div class="bars">${d.utilisation.map((u) => `
          <a class="bar-row" href="#/employees/${u.id}"><span class="bar-name">${esc(u.name)}</span><span class="bar-track"><span class="bar-fill ${u.pct < 60 ? 'warn' : ''}" style="width:${u.pct}%"></span></span><span class="bar-val">${u.pct}% · ${num(u.on_products)}/${num(u.worked)} d</span></a>`).join('')}</div>`
          : empty('fa-users', 'No attendance in this period.')}
      </section>
    </div>`;

  const go = (f, t2) => { location.hash = `#/reports?from=${f}&to=${t2}`; };
  root.querySelector('#from').addEventListener('change', (e) => e.target.value && go(e.target.value, d.to));
  root.querySelector('#to').addEventListener('change', (e) => e.target.value && go(d.from, e.target.value));
  root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    const end = ymd(new Date()).slice(0, 7); const s = parseYmd(end + '-01'); s.setMonth(s.getMonth() - (Number(b.dataset.range) - 1));
    go(ymd(s).slice(0, 7), end);
  }));
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  root.querySelector('#csv').addEventListener('click', () => downloadCsv(`uxonic-pnl-${d.from}-to-${d.to}.csv`, [
    ['Month', 'Invoiced', 'Received', 'Salaries', 'Expenses (excl GST)', 'Profit'],
    ...d.series.map((s) => [s.month, s.invoiced, s.received, s.salaries, s.expenses, s.profit]),
    ['Total', t.invoiced, t.received, t.salaries, t.expenses, t.profit],
  ]));
}

export async function gstView(root, _p, query, alive) {
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : ymd(new Date()).slice(0, 7);
  const g = await api.get('gst', { month });
  if (!alive()) return;
  const shift = (n) => { const x = parseYmd(month + '-01'); x.setMonth(x.getMonth() + n); return ymd(x).slice(0, 7); };
  const part = (label, p) => `<div class="stat"><span class="stat-label">${label} · ${p.count} invoice(s)</span><span class="stat-val">${money(p.taxable)}</span><span class="stat-sub">CGST ${money(p.cgst)} · SGST ${money(p.sgst)} · IGST ${money(p.igst)}</span></div>`;

  root.innerHTML = `
    ${pageHead('GST report', `${fmonth(month)} · outward supplies (GSTR-1 style) and input tax credit — share the export with your CA`,
      '<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export for CA</button>')}
    <div class="toolbar"><div class="date-nav">
      <a class="icon-btn" href="#/gst?month=${shift(-1)}" aria-label="Previous month"><i class="fas fa-chevron-left"></i></a>
      <input type="month" id="month" value="${month}">
      <a class="icon-btn" href="#/gst?month=${shift(1)}" aria-label="Next month"><i class="fas fa-chevron-right"></i></a>
    </div>${g.company_gstin ? `<span class="muted">Your GSTIN: <b>${esc(g.company_gstin)}</b></span>` : '<a class="link" href="#/settings">Add your GSTIN in settings</a>'}</div>
    <div class="stats">
      ${part('B2B (registered)', g.b2b)}${part('B2C (unregistered)', g.b2c)}
      <div class="stat"><span class="stat-label">Output tax</span><span class="stat-val">${money(g.totals.output_tax)}</span></div>
      <div class="stat"><span class="stat-label">Input tax credit (expenses)</span><span class="stat-val">${money(g.itc.total)}</span></div>
      <div class="stat"><span class="stat-label">Net GST payable (approx.)</span><span class="stat-val ${g.net_payable > 0 ? 't-red' : 't-green'}">${money(g.net_payable)}</span></div>
    </div>
    <section class="panel">
      <div class="panel-head"><h2>Invoices</h2></div>
      ${g.rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th>GSTIN</th><th>Type</th><th>Place of supply</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">IGST</th><th class="r">Total</th></tr></thead>
        <tbody>${g.rows.map((r) => `<tr><td><b>${esc(r.invoice_no)}</b></td><td>${esc(r.date)}</td><td>${esc(r.client)}</td><td>${esc(r.gstin || '—')}</td><td>${r.type}</td><td>${esc(r.place || '—')}</td><td class="r">${r.rate}%</td><td class="r">${money(r.taxable)}</td><td class="r">${money(r.cgst)}</td><td class="r">${money(r.sgst)}</td><td class="r">${money(r.igst)}</td><td class="r">${money(r.total)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="7">Total</td><td class="r">${money(g.totals.taxable)}</td><td class="r">${money(g.totals.cgst)}</td><td class="r">${money(g.totals.sgst)}</td><td class="r">${money(g.totals.igst)}</td><td></td></tr></tfoot>
      </table></div>` : empty('fa-file-invoice', 'No sent invoices this month.')}
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Input tax credit (from expenses)</h2></div>
      ${g.itc.rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th class="r">Bill amount</th><th class="r">GST</th></tr></thead>
        <tbody>${g.itc.rows.map((x) => `<tr><td>${esc(x.date)}</td><td>${esc(x.vendor || '—')}</td><td>${esc(x.category)}</td><td class="r">${money(x.amount)}</td><td class="r">${money(x.gst_amount)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">No expenses with GST this month. Enter the GST amount when you add an expense to claim it here.</p>'}
    </section>
    <p class="muted small">This is a working summary to help your CA file GSTR-1/3B. It is not a filed return.</p>`;

  root.querySelector('#month').addEventListener('change', (e) => { if (e.target.value) location.hash = '#/gst?month=' + e.target.value; });
  root.querySelector('#csv').addEventListener('click', () => downloadCsv(`uxonic-gst-${month}.csv`, [
    ['Invoice', 'Date', 'Client', 'GSTIN', 'Type', 'Place of supply', 'Rate %', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'],
    ...g.rows.map((r) => [r.invoice_no, r.date, r.client, r.gstin, r.type, r.place, r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.total]),
    [], ['Input tax credit'], ['Date', 'Vendor', 'Category', 'Amount', 'GST'],
    ...g.itc.rows.map((x) => [x.date, x.vendor, x.category, x.amount, x.gst_amount]),
    [], ['Output tax', g.totals.output_tax], ['ITC', g.itc.total], ['Net payable', g.net_payable],
  ]));
}
