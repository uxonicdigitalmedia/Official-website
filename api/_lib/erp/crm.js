// CRM: leads, follow-ups, activity log, website enquiries → leads, won lead → client
import { must, clean, bad, idOf, today, methodNotAllowed, HttpError } from './core.js';

export const STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];
const SOURCES = 'website|whatsapp|call|referral|instagram|facebook|google|walk-in|other';
const KINDS = 'note|call|whatsapp|email|meeting';
const LEAD_SPEC = {
  name: 'text!', company: 'text', phone: 'text', email: 'text', city: 'text',
  source: `enum:${SOURCES}`, service: 'text', value: 'num', status: `enum:${STAGES.join('|')}`,
  priority: 'enum:low|medium|high', owner_id: 'int', next_follow_up: 'date', lost_reason: 'text', notes: 'text',
};
const LABEL = { new: 'New', contacted: 'Contacted', proposal: 'Proposal sent', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };

// Until database/erp_schema.sql (CRM part) is run, tell the user what to do instead of a raw DB error.
let ready = false;
async function ensureTables(sb) {
  if (ready) return;
  const { error } = await sb.from('erp_leads').select('id').limit(1);
  if (error) throw new HttpError(503, 'CRM is not set up yet. Run the "CRM" part of database/erp_schema.sql in the Supabase SQL editor, then reload.');
  ready = true;
}
const who = (actor) => actor?.name || actor?.email || 'Admin';
const log = (sb, lead_id, kind, body, actor) => sb.from('erp_lead_activities').insert({ lead_id, kind, body, actor: who(actor) }).then(must);

function tidy(row) {
  if (row.email) row.email = row.email.toLowerCase();
  if (row.value != null && row.value < 0) throw bad('Deal value cannot be negative.');
  return row;
}

export async function leads({ sb, method, q, body, actor }) {
  await ensureTables(sb);
  if (method === 'GET') {
    if (q.id) {
      const id = idOf(q);
      const [lead, activities] = await Promise.all([
        sb.from('erp_leads').select('*, erp_employees(id, full_name), erp_clients(id, name, company)').eq('id', id).single().then(must),
        sb.from('erp_lead_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(200).then(must),
      ]);
      return { lead, activities };
    }
    const list = must(await sb.from('erp_leads').select('*, erp_employees(id, full_name)').order('updated_at', { ascending: false }).limit(2000));
    const { count } = await pendingEnquiries(sb);
    return { leads: list, today: today(), pending_enquiries: count };
  }

  if (method === 'POST') {
    if (q.action === 'note') {
      const id = idOf(q);
      const n = clean(body, { kind: `enum:${KINDS}`, body: 'text!', next_follow_up: 'date' });
      must(await sb.from('erp_leads').select('id').eq('id', id).single());
      await log(sb, id, n.kind || 'note', n.body, actor);
      const upd = {};
      if (Object.prototype.hasOwnProperty.call(body || {}, 'next_follow_up')) upd.next_follow_up = n.next_follow_up;
      // Logging a call / message on a new lead moves it to "Contacted"
      const cur = must(await sb.from('erp_leads').select('status').eq('id', id).single());
      if (cur.status === 'new' && n.kind && n.kind !== 'note') upd.status = 'contacted';
      if (Object.keys(upd).length) must(await sb.from('erp_leads').update(upd).eq('id', id));
      return { message: 'Saved to the activity log.' };
    }
    if (q.action === 'import') return importEnquiries(sb, actor);
    if (q.action === 'convert') return convert(sb, idOf(q), actor);

    const row = tidy(clean(body, LEAD_SPEC));
    row.status = row.status || 'new';
    if (row.status === 'won' || row.status === 'lost') row.closed_on = today();
    const lead = must(await sb.from('erp_leads').insert(row).select('*').single());
    await log(sb, lead.id, 'status', `Lead added (${LABEL[lead.status]}).`, actor);
    return { lead, message: 'Lead added.' };
  }

  if (method === 'PUT') {
    const id = idOf(q);
    const before = must(await sb.from('erp_leads').select('*').eq('id', id).single());
    const row = tidy(clean(body, LEAD_SPEC, { partial: true }));
    if (row.status && row.status !== before.status) {
      row.closed_on = row.status === 'won' || row.status === 'lost' ? today() : null;
    }
    const lead = must(await sb.from('erp_leads').update(row).eq('id', id).select('*').single());
    if (row.status && row.status !== before.status) {
      await log(sb, id, 'status', `${LABEL[before.status]} → ${LABEL[row.status]}${row.status === 'lost' && lead.lost_reason ? ` (${lead.lost_reason})` : ''}`, actor);
    }
    return { lead, message: 'Lead updated.' };
  }

  if (method === 'DELETE') {
    must(await sb.from('erp_leads').delete().eq('id', idOf(q)));
    return { message: 'Lead deleted.' };
  }
  throw methodNotAllowed();
}

/** Won → create (or reuse) an ERP client so a quotation / invoice can be raised. */
async function convert(sb, id, actor) {
  const lead = must(await sb.from('erp_leads').select('*').eq('id', id).single());
  if (lead.client_id) {
    const c = (await sb.from('erp_clients').select('*').eq('id', lead.client_id).maybeSingle()).data;
    if (c) return { client: c, lead, message: 'Already a client.' };
  }
  let client = null;
  if (lead.email) client = (await sb.from('erp_clients').select('*').ilike('email', lead.email).limit(1)).data?.[0] || null;
  if (!client && lead.phone) client = (await sb.from('erp_clients').select('*').eq('phone', lead.phone).limit(1)).data?.[0] || null;
  if (!client) {
    client = must(await sb.from('erp_clients').insert({
      name: lead.name, company: lead.company, email: lead.email, phone: lead.phone,
      state: 'Tamil Nadu', state_code: '33', notes: [lead.service, lead.notes].filter(Boolean).join('\n') || null,
    }).select('*').single());
  }
  const upd = { client_id: client.id };
  if (lead.status !== 'won') { upd.status = 'won'; upd.closed_on = today(); }
  const updated = must(await sb.from('erp_leads').update(upd).eq('id', id).select('*').single());
  await log(sb, id, 'status', `${lead.status !== 'won' ? `${LABEL[lead.status]} → Won. ` : ''}Client "${client.company || client.name}" ready for quotation / invoice.`, actor);
  return { client, lead: updated, message: 'Lead converted to a client.' };
}

async function pendingEnquiries(sb) {
  const [subs, done] = await Promise.all([
    sb.from('contact_submissions').select('id').order('submitted_at', { ascending: false }).limit(500),
    sb.from('erp_leads').select('contact_submission_id').not('contact_submission_id', 'is', null),
  ]);
  if (subs.error || done.error) return { count: 0 };
  const seen = new Set(done.data.map((r) => r.contact_submission_id));
  return { count: subs.data.filter((s) => !seen.has(s.id)).length };
}

/** Website contact-form enquiries → leads (each one once). */
async function importEnquiries(sb, actor) {
  const subs = must(await sb.from('contact_submissions').select('*').order('submitted_at', { ascending: true }).limit(500));
  const done = new Set(must(await sb.from('erp_leads').select('contact_submission_id').not('contact_submission_id', 'is', null)).map((r) => r.contact_submission_id));
  const fresh = subs.filter((s) => !done.has(s.id));
  if (!fresh.length) return { imported: 0, message: 'No new website enquiries.' };
  const rows = fresh.map((s) => ({
    name: s.full_name, email: (s.email || '').toLowerCase() || null, source: 'website', service: s.project_type || null,
    notes: s.message, status: 'new', priority: 'medium', contact_submission_id: s.id,
    next_follow_up: today(),
  }));
  const inserted = must(await sb.from('erp_leads').upsert(rows, { onConflict: 'contact_submission_id', ignoreDuplicates: true }).select('id, contact_submission_id'));
  if (inserted.length) {
    const at = new Map(fresh.map((s) => [s.id, s.submitted_at]));
    must(await sb.from('erp_lead_activities').insert(inserted.map((l) => ({
      lead_id: l.id, kind: 'status', actor: who(actor),
      body: `Imported from the website contact form (sent ${String(at.get(l.contact_submission_id) || '').slice(0, 10)}).`,
    }))));
  }
  return { imported: inserted.length, message: `${inserted.length} website enquir${inserted.length === 1 ? 'y' : 'ies'} added as leads.` };
}

/** Small summary for the dashboard; never fails the dashboard. */
export async function crmSummary(sb) {
  const { data, error } = await sb.from('erp_leads').select('status, next_follow_up, value');
  if (error) return null;
  const t = today();
  const open = data.filter((l) => l.status !== 'won' && l.status !== 'lost');
  return {
    open: open.length,
    due: open.filter((l) => l.next_follow_up && l.next_follow_up <= t).length,
    pipeline_value: open.reduce((s, l) => s + Number(l.value || 0), 0),
  };
}
