import { randomUUID } from 'node:crypto';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export function growSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS grow_items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, state TEXT NOT NULL, evidence TEXT NOT NULL, due_at TEXT, minutes INTEGER, version INTEGER NOT NULL, updated_at TEXT NOT NULL)`);
}
export function listGrow(db) {
  return db.prepare('SELECT * FROM grow_items ORDER BY updated_at DESC, id').all().map(row => ({ ...row, evidence: JSON.parse(row.evidence) }));
}
export function saveGrow(db, input) {
  const old = input.id ? db.prepare('SELECT * FROM grow_items WHERE id=?').get(input.id) : null;
  if (input.id && !old) fail('Goal or interpretation no longer exists.', 404);
  if (old && input.version !== old.version) fail('This item changed. Reload before editing.', 409);
  if (!['goal','interpretation'].includes(input.kind) || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 180) fail('Supply a kind and a short title.');
  if (!['active','paused','rejected','confirmed'].includes(input.state || 'active')) fail('Invalid state.');
  if (typeof (input.detail || '') !== 'string' || (input.detail || '').length > 2000) fail('Detail is too long.');
  if (input.due_at && (!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(input.due_at) || !Number.isFinite(Date.parse(input.due_at)))) fail('Deadline needs an explicit timezone.');
  if (input.minutes != null && (!Number.isSafeInteger(input.minutes) || input.minutes < 1 || input.minutes > 525600)) fail('Remaining effort must be positive whole minutes.');
  const suggestion = input.suggestionId ? suggestGrow(db).find(s => s.id === input.suggestionId) : null;
  if (input.suggestionId && !suggestion) fail('This observation is no longer supported. Reload.',409);
  const evidence = old ? JSON.parse(old.evidence) : suggestion?.evidence || { source: 'user-stated', quote: input.detail || input.title };
  const item = { id: old?.id || randomUUID(), kind: input.kind, title: input.title.trim(), detail: input.detail || '', state: input.state || 'active', evidence, due_at: input.due_at || null, minutes: input.minutes ?? null, version: (old?.version || 0) + 1, updated_at: new Date().toISOString() };
  db.prepare('INSERT OR REPLACE INTO grow_items VALUES (?,?,?,?,?,?,?,?,?,?)').run(item.id,item.kind,item.title,item.detail,item.state,JSON.stringify(item.evidence),item.due_at,item.minutes,item.version,item.updated_at);
  return item;
}
export function suggestGrow(db) {
  const groups=new Map();
  for(const row of db.prepare('SELECT id,text FROM bee_todos ORDER BY id').all()){
    const tokens=new Set(row.text.toLowerCase().match(/[\p{L}]{5,}/gu)||[]);
    for(const word of tokens){if(/^(would|should|about|their|there|which|before|after|tomorrow|please|schedule|meeting|finish|complete|completed)$/.test(word))continue;const values=groups.get(word)||[];values.push({id:row.id,quote:row.text});groups.set(word,values);}
  }
  return [...groups].filter(([,rows])=>rows.length>=3).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,3).map(([word,rows])=>({id:word,title:`Repeated topic: ${word}`,detail:`Appears in ${rows.length} Bee task records. Repetition alone does not establish importance or motivation.`,evidence:{source:'bee-task-topic-rule-v1',interpretation:true,support:rows.slice(0,5),count:rows.length}}));
}
export function growObservations(db) {
  const rows = db.prepare("SELECT substr(created_at,1,10) AS day,count(*) AS n FROM commitments WHERE json_extract(evidence,'$.origin')='bee_todo' GROUP BY day ORDER BY day").all();
  return { daily: rows, note: 'Observed dates of Bee task records, not completed work or productivity scores. Interpretations remain editable.' };
}
