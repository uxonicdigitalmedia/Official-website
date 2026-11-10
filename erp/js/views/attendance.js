import { api, esc, fdate, fmonth, num, pageHead, empty, toast, toastErr, downloadCsv } from '../core.js';
import { ymd, parseYmd, monthDates } from '../calc.js';

const STATUSES = [
  ['present', 'P', 'Present'],
  ['half-day', 'H', 'Half day'],
  ['leave', 'L', 'Leave (paid)'],
  ['holiday', 'HO', 'Holiday'],
  ['absent', 'A', 'Absent'],
];

const shiftDate = (s, days) => { const d = parseYmd(s); d.setDate(d.getDate() + days); return ymd(d); };

export async function attendanceDay(root, _p, query, alive) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ? query.date : ymd(new Date());
  const [att, prods] = await Promise.all([api.get('attendance', { date }), api.get('products')]);
  if (!alive()) return;

  const products = prods.products.filter((p) => p.status !== 'completed');
  const rec = new Map(att.records.map((r) => [r.employee_id, r]));
  // working state per employee
  const state = new Map(att.employees.map((e) => {
    const r = rec.get(e.id);
    return [e.id, { status: r?.status || '', product_id: r?.product_id || att.last_product?.[e.id] || '', note: r?.note || '', saved: !!r }];
  }));
  let dirty = false;
  const weekday = parseYmd(date).toLocaleDateString('en-IN', { weekday: 'long' });

  root.innerHTML = `
    ${pageHead('Attendance', `${weekday}, ${fdate(date)}`,
      `<a class="btn btn-ghost" href="#/attendance/month?month=${date.slice(0, 7)}"><i class="fas fa-table-cells"></i> Monthly sheet</a>`)}
    <div class="toolbar">
      <div class="date-nav">
        <button class="icon-btn" id="prev" aria-label="Previous day"><i class="fas fa-chevron-left"></i></button>
        <input type="date" id="date" value="${date}">
        <button class="icon-btn" id="next" aria-label="Next day"><i class="fas fa-chevron-right"></i></button>
        <button class="btn btn-ghost btn-sm" id="today">Today</button>
      </div>
      <div class="toolbar-right">
        <span class="muted" id="summary"></span>
        <button class="btn btn-ghost btn-sm" id="allP"><i class="fas fa-check-double"></i> Mark all present</button>
        <button class="btn btn-ghost btn-sm" id="allHo"><i class="fas fa-umbrella-beach"></i> Holiday for all</button>
      </div>
    </div>
    ${att.employees.length ? `
      <div class="table-wrap"><table class="table att-table">
        <thead><tr><th>Employee</th><th>Status</th><th>Worked on</th><th>Note</th></tr></thead>
        <tbody>${att.employees.map((e) => `
          <tr data-emp="${e.id}">
            <td><div class="person"><span class="avatar sm">${esc(e.full_name.charAt(0))}</span><div><b>${esc(e.full_name)}</b><small>${esc(e.emp_code)} · ${esc(e.designation || '')}</small>
              ${rec.get(e.id)?.check_in ? `<small class="block t-green"><i class="fas fa-mobile-screen"></i> in ${esc(rec.get(e.id).check_in)}${rec.get(e.id).check_out ? ' · out ' + esc(rec.get(e.id).check_out) : ''}</small>` : ''}
              ${rec.get(e.id)?.source === 'leave' ? '<small class="block muted"><i class="fas fa-umbrella-beach"></i> approved leave</small>' : ''}</div></div></td>
            <td><div class="status-pick" role="radiogroup" aria-label="Status for ${esc(e.full_name)}">
              ${STATUSES.map(([v, short, label]) => `<button type="button" role="radio" data-s="${v}" class="sp sp-${v}" title="${label}" aria-label="${label}">${short}</button>`).join('')}
            </div></td>
            <td><select class="prod" aria-label="Product for ${esc(e.full_name)}"><option value="">— none —</option>${products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></td>
            <td><input class="note-in" placeholder="Optional" maxlength="200" aria-label="Note for ${esc(e.full_name)}"></td>
          </tr>`).join('')}</tbody>
      </table></div>
      <div class="savebar" id="savebar">
        <span><i class="fas fa-circle-info"></i> Unsaved changes</span>
        <button class="btn btn-ghost btn-sm" id="reset">Discard</button>
        <button class="btn btn-primary" id="save"><i class="fas fa-floppy-disk"></i> Save attendance</button>
      </div>`
    : empty('fa-users', 'No active employees on this date.', '<a class="btn btn-primary" href="#/employees">Add employees</a>')}
    <p class="muted mt small">P = present · H = half day · L = paid leave · HO = holiday · A = absent. "Worked on" tracks how many days each person spent on a product (used for product cost). Click a selected status again to clear it.</p>`;

  const go = (d) => {
    if (dirty && !confirm('You have unsaved attendance. Leave without saving?')) return;
    location.hash = '#/attendance?date=' + d;
  };
  root.querySelector('#prev').addEventListener('click', () => go(shiftDate(date, -1)));
  root.querySelector('#next').addEventListener('click', () => go(shiftDate(date, 1)));
  root.querySelector('#today').addEventListener('click', () => go(ymd(new Date())));
  root.querySelector('#date').addEventListener('change', (e) => e.target.value && go(e.target.value));
  if (!att.employees.length) return;

  const paint = () => {
    root.querySelectorAll('tr[data-emp]').forEach((tr) => {
      const st = state.get(Number(tr.dataset.emp));
      tr.querySelectorAll('.sp').forEach((b) => { const on = b.dataset.s === st.status; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      const sel = tr.querySelector('.prod');
      sel.value = String(st.product_id || '');
      sel.disabled = !['present', 'half-day'].includes(st.status);
      tr.querySelector('.note-in').value = st.note;
      tr.classList.toggle('unset', !st.status);
    });
    const c = {}; state.forEach((s) => { c[s.status || 'none'] = (c[s.status || 'none'] || 0) + 1; });
    root.querySelector('#summary').textContent = `${c.present || 0} present · ${c['half-day'] || 0} half · ${c.leave || 0} leave · ${c.absent || 0} absent · ${c.none || 0} not marked`;
    root.querySelector('#savebar').classList.toggle('show', dirty);
  };
  const touch = () => { dirty = true; paint(); };

  root.querySelectorAll('tr[data-emp]').forEach((tr) => {
    const st = state.get(Number(tr.dataset.emp));
    tr.querySelectorAll('.sp').forEach((b) => b.addEventListener('click', () => { st.status = st.status === b.dataset.s ? '' : b.dataset.s; touch(); }));
    tr.querySelector('.prod').addEventListener('change', (e) => { st.product_id = e.target.value; dirty = true; root.querySelector('#savebar').classList.add('show'); });
    tr.querySelector('.note-in').addEventListener('input', (e) => { st.note = e.target.value; dirty = true; root.querySelector('#savebar').classList.add('show'); });
  });
  const setAll = (s) => { state.forEach((st) => { st.status = s; }); touch(); };
  root.querySelector('#allP').addEventListener('click', () => setAll('present'));
  root.querySelector('#allHo').addEventListener('click', () => setAll('holiday'));
  root.querySelector('#reset').addEventListener('click', () => dispatchEvent(new Event('erp:refresh')));
  root.querySelector('#save').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const entries = [...state.entries()]
      .filter(([, s]) => s.status || s.saved)
      .map(([employee_id, s]) => ({ employee_id, status: s.status || null, product_id: s.product_id || null, note: s.note || null }));
    if (!entries.length) { toast('Mark at least one employee.', 'warn'); return; }
    btn.disabled = true;
    try {
      const r = await api.post('attendance', { date, entries });
      toast(r.message, r.skipped?.length ? 'warn' : 'ok');
      state.forEach((s) => { s.saved = !!s.status; });
      dirty = false; paint();
    } catch (err) { toastErr(err); }
    finally { btn.disabled = false; }
  });
  window.onbeforeunload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; // reset by the router
  paint();
}

export async function attendanceMonth(root, _p, query, alive) {
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : ymd(new Date()).slice(0, 7);
  const [att, settings] = await Promise.all([api.get('attendance', { month }), api.get('settings')]);
  if (!alive()) return;
  const off = new Set(settings.settings.weekly_off || [0]);
  const dates = monthDates(month);
  const map = new Map(att.records.map((r) => [`${r.employee_id}|${r.date}`, r]));
  const short = Object.fromEntries(STATUSES.map(([v, s]) => [v, s]));
  const todayStr = ymd(new Date());

  const totals = (eid) => {
    const t = { present: 0, 'half-day': 0, leave: 0, holiday: 0, absent: 0 };
    dates.forEach((d) => { const r = map.get(`${eid}|${d}`); if (r) t[r.status]++; });
    t.worked = t.present + t['half-day'] * 0.5;
    return t;
  };
  const prevMonth = (() => { const d = parseYmd(month + '-01'); d.setMonth(d.getMonth() - 1); return ymd(d).slice(0, 7); })();
  const nextMonth = (() => { const d = parseYmd(month + '-01'); d.setMonth(d.getMonth() + 1); return ymd(d).slice(0, 7); })();

  root.innerHTML = `
    ${pageHead('Monthly attendance', fmonth(month),
      `<button class="btn btn-ghost" id="csv"><i class="fas fa-download"></i> Export CSV</button>
       <a class="btn btn-primary" href="#/attendance"><i class="fas fa-calendar-day"></i> Mark today</a>`)}
    <div class="toolbar">
      <div class="date-nav">
        <a class="icon-btn" href="#/attendance/month?month=${prevMonth}" aria-label="Previous month"><i class="fas fa-chevron-left"></i></a>
        <input type="month" id="month" value="${month}">
        <a class="icon-btn" href="#/attendance/month?month=${nextMonth}" aria-label="Next month"><i class="fas fa-chevron-right"></i></a>
      </div>
      <div class="legend">${STATUSES.map(([v, s, l]) => `<span><i class="cell-mini c-${v}">${s}</i>${l}</span>`).join('')}<span><i class="cell-mini c-off"></i>Weekly off</span></div>
    </div>
    ${att.employees.length ? `<div class="table-wrap sheet-wrap"><table class="sheet">
      <thead><tr><th class="sticky">Employee</th>${dates.map((d) => {
        const dt = parseYmd(d);
        return `<th class="${off.has(dt.getDay()) ? 'off' : ''} ${d === todayStr ? 'today' : ''}"><small>${dt.toLocaleDateString('en-IN', { weekday: 'narrow' })}</small>${dt.getDate()}</th>`;
      }).join('')}<th>Worked</th><th>Leave</th><th>Absent</th></tr></thead>
      <tbody>${att.employees.map((e) => {
        const t = totals(e.id);
        return `<tr><th class="sticky"><a href="#/employees/${e.id}">${esc(e.full_name)}</a></th>${dates.map((d) => {
          const r = map.get(`${e.id}|${d}`);
          const isOff = off.has(parseYmd(d).getDay());
          return `<td class="${r ? 'c-' + r.status : isOff ? 'c-off' : ''}"><a href="#/attendance?date=${d}" title="${d}${r ? ' · ' + r.status : ''}">${r ? short[r.status] : ''}</a></td>`;
        }).join('')}<td class="tot">${num(t.worked)}</td><td class="tot">${t.leave + t.holiday}</td><td class="tot">${t.absent}</td></tr>`;
      }).join('')}</tbody></table></div>`
    : empty('fa-users', 'No employees for this month.')}`;

  root.querySelector('#month').addEventListener('change', (e) => { if (e.target.value) location.hash = '#/attendance/month?month=' + e.target.value; });
  root.querySelector('#csv').addEventListener('click', () => downloadCsv(`uxonic-attendance-${month}.csv`, [
    ['Code', 'Employee', ...dates.map((d) => d.slice(8)), 'Worked', 'Leave+Holiday', 'Absent'],
    ...att.employees.map((e) => {
      const t = totals(e.id);
      return [e.emp_code, e.full_name, ...dates.map((d) => short[map.get(`${e.id}|${d}`)?.status] || ''), t.worked, t.leave + t.holiday, t.absent];
    }),
  ]));
}
