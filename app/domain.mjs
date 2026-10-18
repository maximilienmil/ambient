import { createHash, randomUUID } from 'node:crypto';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = () => randomUUID();
const now = () => new Date().toISOString();
export const initialState = () => ({ sources: [], commitments: [], plans: [], events: [], version: 0, agentRuns: [] });
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function record(s, entity, type, detail = '') { s.events.unshift({ id: id(), entity, type, detail, at: now() }); s.events = s.events.slice(0, 500); }
export const sample = `You: I'll send Priya the project deck by tonight.
You: We should get dinner sometime.
You: I'd like to read the book Maya mentioned.
You: Actually, never mind about the tickets.
Sam: I'll book the restaurant.`;

// Deliberately conservative offline baseline, not a language model or calibrated classifier.
export function extract(text, wearer = 'You') {
  const found = [];
  let ignored = 0;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const m = line.trim().match(/^(?:[-*]\s*)?([^:]{1,60}):\s*(.+)$/);
    if (!m) { if (line.trim()) ignored++; continue; }
    const [, speaker, quote] = m;
    if (speaker.trim().toLowerCase() !== wearer.trim().toLowerCase()) { ignored++; continue; }
    if (/\b(won't|will not|never mind|don't|do not|can't|cannot|maybe|might|jok(?:e|ing)|said|says|if|cancel|actually|ignore (?:previous|all)|system prompt)\b/i.test(quote) || /[“”"]/.test(quote)) { ignored++; continue; }
    let tier, reason;
    if (/^(?:I['’]ll|I will|I promise to)\s+/i.test(quote)) {
      tier = 'draft'; reason = 'Explicit first-person promise. A local draft is allowed; external sending is disabled.';
    } else if (/^(?:we should|let['’]s)\s+/i.test(quote)) {
      tier = 'ask'; reason = 'Shared intent needs your confirmation before any planning or disclosure.';
    } else if (/^(?:I['’]d like to|I want to|I should)\s+/i.test(quote)) {
      tier = 'remember'; reason = 'An interest without a firm promise. No action is prepared.';
    } else { ignored++; continue; }
    found.push({ speaker: speaker.trim(), quote, line: index + 1, tier, reason, title: quote.replace(/^(?:I['’]ll|I will|I promise to|we should|let['’]s|I['’]d like to|I want to|I should)\s+/i, '').replace(/[.!]$/, '') });
  }
  // Retractions invalidate earlier candidates in this source. Ask the user to clarify, never guess the referent.
  const retracted = new Set(
    text
      .split(/\r?\n/)
      .map((line, index) => (/\b(?:never mind|forget (?:it|that)|cancel(?:led|ing)?|changed my mind|scratch that|disregard)\b/i.test(line) ? index + 1 : null))
      .filter(Boolean),
  );
  for (const candidate of found) {
    if ([...retracted].some((line) => line > candidate.line)) {
      candidate.tier = 'ask';
      candidate.reason = 'A later remark in this conversation may retract this. Confirm before acting.';
    }
  }
  return { found, ignored };
}

export function importSource(s, { text, name = 'Imported conversation', wearer = 'You', provider = 'manual', externalId = null }) {
  if (typeof text !== 'string' || !text.trim() || text.length > 100000) fail('Provide a transcript between 1 and 100,000 characters.');
  if (typeof wearer !== 'string' || !wearer.trim() || wearer.length > 60) fail('Enter your exact speaker label.');
  if (typeof name !== 'string' || !name.trim() || name.length > 200) fail('Enter a source name under 200 characters.');
  const fingerprint = hash({ text: text.trim(), wearer: wearer.trim().toLowerCase(), provider, externalId });
  const prior = s.sources.find(x => x.fingerprint === fingerprint);
  if (prior) return { source: prior, duplicate: true, count: s.commitments.filter(x => x.sourceId === prior.id).length };
  // A changed Bee revision invalidates old pending actions. Keep no old text.
  if (externalId) for (const src of [...s.sources]) if (src.provider === provider && src.externalId === externalId) deleteSource(s, src.id);
  const { found, ignored } = extract(text, wearer);
  const source = { id: id(), name: name.trim(), provider, externalId, fingerprint, importedAt: now(), ignored, count: found.length, transcript: text.trim() };
  s.sources.push(source);
  for (const candidate of found) {
    const commitment = { id: id(), sourceId: source.id, ...candidate, title: candidate.title[0].toUpperCase() + candidate.title.slice(1), owner: wearer, status: 'open', due: '', snoozedUntil: null, version: 1, createdAt: now(), updatedAt: now(), draft: '', approval: null, action: null, completion: null, agent: null };
    s.commitments.push(commitment);
  }
  record(s, source.id, 'source_imported', `${found.length} candidates; ${ignored} lines not retained`);
  return { source, count: found.length, duplicate: false };
}
export function getCommitment(s, key) { const c = s.commitments.find(x => x.id === key); if (!c) fail('Commitment not found.', 404); return c; }
export function updateCommitment(s, key, body) {
  const c = getCommitment(s, key);
  if (body.version !== c.version) fail('This item changed. Refresh before saving.', 409);
  if (c.status === 'dismissed' && body.status !== 'open') fail('Reopen this item before editing.');
  for (const field of ['title', 'draft', 'due']) if (field in body) {
    if (typeof body[field] !== 'string' || body[field].length > (field === 'draft' ? 10000 : 300)) fail('Invalid field length.');
    if (field === 'title' && !body[field].trim()) fail('A title is required.');
    if (field === 'due' && body[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(body[field]) || !Number.isFinite(Date.parse(body[field])) || new Date(body[field]).toISOString().slice(0, 10) !== body[field])) fail('Choose a valid due date.');
    c[field] = body[field].trim();
  }
  if ('status' in body) {
    if (!['open', 'completed', 'dismissed'].includes(body.status)) fail('Invalid state.');
    c.status = body.status;
    c.completion = body.status === 'completed' ? { type: 'user_reported', at: now() } : null;
  }
  if ('snoozedUntil' in body) {
    if (body.snoozedUntil !== null && (!Number.isFinite(Date.parse(body.snoozedUntil)) || Date.parse(body.snoozedUntil) <= Date.now())) fail('Choose a future snooze time.');
    c.snoozedUntil = body.snoozedUntil;
  }
  if (body.confirmIntent === true) { c.tier = 'draft'; c.reason = 'You confirmed this intent. External sending remains disabled.'; }
  c.version++; c.updatedAt = now(); c.approval = null;
  // Retain the previous execution receipt, but it does not approve a new version.
  record(s, c.id, 'commitment_updated', body.status || 'fields changed');
  return c;
}
export function approveDraft(s, key, version) {
  const c = getCommitment(s, key);
  if (c.version !== version) fail('Draft changed. Review the latest version.', 409);
  if (c.status !== 'open' || c.tier !== 'draft' || !c.draft.trim()) fail('Confirm intent and write a draft first.');
  c.approval = { hash: hash({ draft: c.draft, version: c.version }), at: now(), version: c.version };
  record(s, c.id, 'draft_approved', 'Local text export only'); return c;
}
export function executeDraft(s, key, version) {
  const c = getCommitment(s, key);
  if (c.version !== version || c.status !== 'open') fail('Action is stale or no longer open.', 409);
  if (!c.approval || c.approval.hash !== hash({ draft: c.draft, version: c.version })) fail('Review and approve this draft version first.', 409);
  if (c.action?.version === version) return c;
  c.action = { id: id(), type: 'local_draft', version, text: c.draft, at: now() };
  record(s, c.id, 'draft_prepared', 'Not sent'); return c;
}
export function completeAgentRun(s, key, version, result) {
  const c=getCommitment(s,key);if(c.version!==version)fail('This commitment changed while Latent was working.',409);
  if(c.status!=='open')fail('This commitment is no longer open.',409);
  if(c.agent?.state==='working')fail('Latent is already working on this commitment.',409);
  if(!result||typeof result!=='object')fail('The agent did not return a usable plan.',502);
  const state=['ready','needs_you','remembered'].includes(result.state)?result.state:'needs_you';
  if(state==='ready'&&(!['prepare_email','prepare_message','prepare_action'].includes(result.action)||typeof result.body!=='string'||result.body.length>10000))fail('The agent plan failed validation.',502);
  if(result.body && /\b(?:send (?:it|the email)|sent|delivered)\b/i.test(result.body))fail('The agent returned ambiguous external-action wording.',502);
  c.draft=state==='ready'?result.body:'';
  c.agent={id:id(),state,action:state==='ready'?result.action:null,summary:String(result.summary||'').slice(0,500),reason:String(result.reason||'').slice(0,500),subject:String(result.subject||'').slice(0,300),body:c.draft,clarification:String(result.clarification||'').slice(0,500),steps:Array.isArray(result.steps)?result.steps.slice(0,5).map(x=>String(x).slice(0,240)):[],model:String(result.model||'').slice(0,100),at:now(),version};
  record(s,c.id,state==='ready'?'agent_prepared':state==='remembered'?'agent_remembered':'agent_needs_you',c.agent.summary);
  return c;
}
export function startAgentRun(s,key,version){const c=getCommitment(s,key);if(c.version!==version)fail('Commitment changed; refresh before handoff.',409);if(c.status!=='open')fail('Only an open commitment can be handed to Latent.');if(c.agent?.state==='working')return c.agent;c.agent={id:id(),state:'working',steps:[],at:now(),version};record(s,c.id,'agent_started','Local agent run');return c.agent;}
export function updateAgentStep(s,key,version,result){const c=getCommitment(s,key);if(c.version!==version)fail('Commitment changed while Latent was working.',409);if(c.agent?.state!=='working')fail('No active agent run.');c.agent.steps.push(String(result).slice(0,240));c.agent.steps=c.agent.steps.slice(0,5);c.agent.at=now();return c.agent;}
export function deleteSource(s, key) {
  if (!s.sources.some(x => x.id === key)) fail('Source not found.', 404);
  const keys = s.commitments.filter(x => x.sourceId === key).map(x => x.id);
  const planKeys = s.plans.filter(x => keys.includes(x.commitmentId)).map(x => x.id);
  s.sources = s.sources.filter(x => x.id !== key);
  s.commitments = s.commitments.filter(x => !keys.includes(x.id));
  s.plans = s.plans.filter(x => !planKeys.includes(x.id));
  s.events = s.events.filter(x => ![key, ...keys, ...planKeys].includes(x.entity));
  return { deleted: true };
}

// Separate availability fixtures. Only intersection candidates enter protocol messages.
export const calendars = { you: [18, 19, 20], sam: [19, 21] };
export function createPlan(s, { commitmentId, consent, date }) {
  const c = getCommitment(s, commitmentId);
  if (c.status !== 'open' || consent !== true) fail('An open commitment and disclosure consent are required.');
  if (!/\bdinner\b/i.test(c.title)) fail('This MVP supports dinner coordination only.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || new Date(date).toISOString().slice(0, 10) !== date || date < new Date().toISOString().slice(0, 10)) fail('Choose a valid date today or later.');
  const existing = s.plans.find(x => x.commitmentId === c.id && !['cancelled', 'expired'].includes(x.state));
  if (existing) return existing;
  const shared = calendars.you.filter(hour => calendars.sam.includes(hour));
  const p = { id: id(), commitmentId, state: shared.length ? 'awaiting_approval' : 'no_overlap', date, hour: shared[0] || null, timezone: 'UTC', duration: 60, version: 1, approvals: [], expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: now(), hold: null, messages: [ { from: 'you', type: 'PROPOSE', windows: calendars.you.map(h => `${date} ${h}:00 UTC`) }, { from: 'sam', type: shared.length ? 'COUNTER' : 'DECLINE', windows: shared.length ? [`${date} ${shared[0]}:00 UTC`] : [] } ] };
  s.plans.push(p); record(s, p.id, 'negotiation_started', 'Sandbox personas; selected free windows only'); return p;
}
export function getPlan(s, key) { const p = s.plans.find(x => x.id === key); if (!p) fail('Plan not found.', 404); return p; }
function livePlan(s, key) { const p = getPlan(s, key); const c = getCommitment(s, p.commitmentId); if (c.status !== 'open') fail('The source commitment is no longer open.', 409); if (Date.parse(p.expiresAt) <= Date.now()) fail('Proposal expired. Cancel it and start another.', 409); if (['cancelled', 'no_overlap'].includes(p.state)) fail('This plan cannot be approved.', 409); return p; }
export function approvePlan(s, key, { actor, version }) {
  const p = livePlan(s, key); if (p.version !== version) fail('Proposal changed.', 409);
  if (!['you', 'sam'].includes(actor)) fail('Invalid sandbox persona.');
  if (!p.approvals.includes(actor)) { p.approvals.push(actor); record(s, p.id, 'plan_approved', `${actor} · sandbox v${version}`); }
  return p;
}
export function executePlan(s, key, version) {
  const p = livePlan(s, key); if (p.version !== version) fail('Proposal changed.', 409);
  if (p.hold) return p;
  if (!['you','sam'].every(x => p.approvals.includes(x))) fail('Both sandbox personas must approve.', 409);
  if (!calendars.you.includes(p.hour) || !calendars.sam.includes(p.hour)) fail('Availability changed.', 409);
  p.hold = { id: id(), at: now() }; p.state = 'scheduled';
  record(s, p.id, 'private_hold_created', 'Local calendar; no invitation sent'); return p;
}
export function cancelPlan(s, key) { const p = getPlan(s, key); p.state = 'cancelled'; p.approvals = []; p.hold = null; record(s, p.id, 'plan_cancelled', 'Previously exported ICS files cannot be recalled'); return p; }
export function calendarFile(p) {
  if (!p.hold || p.state !== 'scheduled') fail('Save a private hold first.', 409);
  const start = `${p.date.replaceAll('-','')}T${String(p.hour).padStart(2,'0')}0000Z`;
  const end = `${p.date.replaceAll('-','')}T${String(p.hour + 1).padStart(2,'0')}0000Z`;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Latent//Private Hold//EN','BEGIN:VEVENT',`UID:${p.hold.id}@latent.local`,`DTSTAMP:${p.hold.at.replaceAll(/[-:]/g,'').replace(/\.\d+Z/,'Z')}`,`DTSTART:${start}`,`DTEND:${end}`,'SUMMARY:Dinner planning hold (Latent sandbox)','DESCRIPTION:Private planning hold. No invitation sent. Confirm details separately.','CLASS:PRIVATE','STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
