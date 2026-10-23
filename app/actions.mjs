import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
const fail = (message,status=400) => { throw Object.assign(new Error(message),{status}); };
export const digest = payload => createHash('sha256').update(JSON.stringify(payload)).digest('hex');
export function actionSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS action_bundles (id TEXT PRIMARY KEY, payload TEXT NOT NULL, hash TEXT NOT NULL, state TEXT NOT NULL, approved_hash TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS action_results (bundle_id TEXT NOT NULL, step TEXT NOT NULL, status TEXT NOT NULL, receipt TEXT, PRIMARY KEY(bundle_id,step));`);
}
export function connectorStatus(env=process.env) {
  return { provider: 'gog', configured: Boolean(env.AMBIENT_DEMO_ACCOUNT && env.AMBIENT_DEMO_CALENDAR), enabled: env.AMBIENT_EXTERNAL_ACTIONS === '1', account: env.AMBIENT_DEMO_ACCOUNT || null, calendar: env.AMBIENT_DEMO_CALENDAR || null, d1: 'idle' };
}
function validate(payload) {
  if (!payload || typeof payload !== 'object') fail('Supply an action payload.');
  if (!['sandbox','google'].includes(payload.executor)) fail('Choose sandbox or google.');
  if (typeof payload.goal !== 'string' || !payload.goal.trim() || payload.goal.length>180) fail('Name the goal.');
  if (!Array.isArray(payload.blocks) || !payload.blocks.length || payload.blocks.length>8) fail('Supply one to eight focus blocks.');
  for (const b of payload.blocks) {
    if (typeof b.start !== 'string' || typeof b.end !== 'string' || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(b.start) || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(b.end) || !(Date.parse(b.end)>Date.parse(b.start))) fail('Focus blocks need valid zoned start/end times.');
  }
  const sorted=payload.blocks.slice().sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  if(sorted.some((b,i)=>i && Date.parse(b.start)<Date.parse(sorted[i-1].end))) fail('Focus blocks overlap.');
  const m=payload.message;
  if (!m || typeof m.to!=='string' || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(m.to) || typeof m.subject!=='string' || !m.subject.trim() || /[\r\n]/.test(m.subject) || m.subject.length>200 || typeof m.body!=='string' || !m.body.trim() || m.body.length>10000) fail('Supply one recipient, subject and message.');
  return { executor:payload.executor,goal:payload.goal.trim(),blocks:payload.blocks.map(b=>({start:b.start,end:b.end})),message:{to:m.to,subject:m.subject,body:m.body} };
}
export function getBundle(db,id) {
  const b=db.prepare('SELECT * FROM action_bundles WHERE id=?').get(id);if(!b)fail('Action no longer exists.',404);
  return {...b,payload:JSON.parse(b.payload),results:db.prepare('SELECT * FROM action_results WHERE bundle_id=?').all(id).map(r=>({...r,receipt:r.receipt?JSON.parse(r.receipt):null}))};
}
export function prepareBundle(db,payload) {
  payload=validate(payload);const id=randomUUID(),hash=digest(payload);
  db.prepare('INSERT INTO action_bundles VALUES (?,?,?,?,?,?)').run(id,JSON.stringify(payload),hash,'prepared',null,new Date().toISOString());return getBundle(db,id);
}
export function approveBundle(db,id,hash) {
  const b=getBundle(db,id);if(b.hash!==hash)fail('Payload changed. Review the latest version.',409);
  if(!['prepared','approved'].includes(b.state))fail('This action cannot be approved again.',409);
  db.prepare("UPDATE action_bundles SET state='approved',approved_hash=? WHERE id=?").run(hash,id);return getBundle(db,id);
}
async function gog(args,env,input=null) {
  const argv=[...args,'--account',env.AMBIENT_DEMO_ACCOUNT,'--json','--no-input'];
  const stdout=await new Promise((resolve,reject)=>{
    const child=execFile(env.GOG_BIN||'gog',argv,{timeout:30000,maxBuffer:1024*1024},(error,stdout)=>error?reject(new Error('Google connector request failed. Check account authorization.')):resolve(stdout));
    child.stdin.end(input||'');
  });return JSON.parse(stdout);
}
export function googleExecutor(env=process.env) {
  const status=connectorStatus(env);
  return {
    async check(blocks){
      if(!status.configured||!status.enabled)fail('Connect and enable the dedicated demo account before external actions.',409);
      // Check identity before any mutation; configuration alone is not authentication.
      const auth=await gog(['auth','list'],env);
      if(!(auth.accounts||[]).some(a=>(a.email||a.account)===env.AMBIENT_DEMO_ACCOUNT))fail('Dedicated demo account is not authenticated in gog.',409);
      for(const block of blocks){
        if(Date.parse(block.start)<=Date.now())fail('A focus block is in the past. Recalculate the plan.',409);
        const data=await gog(['calendar','events',env.AMBIENT_DEMO_CALENDAR,'--from',block.start,'--to',block.end,'--all-pages'],env);
        const events=Array.isArray(data)?data:data.events;
        if(!Array.isArray(events))fail('Calendar availability response could not be verified.',502);
        if(events.some(e=>e.status!=='cancelled'&&e.transparency!=='transparent'))fail('Calendar availability changed. Review a new plan.',409);
      }
    },
    async hold(block,id,title){
      const r=await gog(['calendar','create',env.AMBIENT_DEMO_CALENDAR,'--private-prop',`ambientAction=${id}`,'--summary',title,'--from',block.start,'--to',block.end,'--visibility','private','--send-updates','none'],env);
      const event=r.event||r;if(!event.id)throw new Error('Calendar returned no event ID.');return {provider:'google-calendar',id:event.id,url:event.htmlLink||null,kind:'calendar_hold',at:new Date().toISOString()};
    },
    async send(message){
      const r=await gog(['gmail','send','--to',message.to,'--subject',message.subject,'--body-file','-'],env,message.body);
      const id=r.messageId||r.id||r.message_id;if(!id)throw new Error('Gmail returned no message ID.');return {provider:'gmail',id,kind:'message_sent',recipientAgreement:'pending',at:new Date().toISOString()};
    },
  };
}
export async function executeBundle(db,id,executor=null) {
  const b=getBundle(db,id);if(b.state==='complete')return b;
  if(b.state!=='approved'||b.approved_hash!==digest(b.payload))fail('Review and approve this exact payload before execution.',409);
  if(b.results.some(r=>r.status==='unknown'||r.status==='running'))fail('An earlier attempt has an unknown outcome. Reconcile its provider receipt before retrying.',409);
  const sandbox=b.payload.executor==='sandbox';
  executor=executor||(sandbox?{check:async()=>{},hold:async(block,key)=>({provider:'local-sandbox',kind:'local_calendar_hold',id:key,...block}),send:async()=>({provider:'local-sandbox',kind:'message_prepared',sent:false})}:googleExecutor());
  await executor.check(b.payload.blocks);
  // Atomic claim prevents simultaneous API requests from dispatching twice.
  const claimed=db.prepare("UPDATE action_bundles SET state='executing' WHERE id=? AND state='approved'").run(id);if(!claimed.changes)fail('Action is already executing.',409);
  const steps=[...b.payload.blocks.map((block,i)=>({key:`hold-${i}`,run:()=>executor.hold(block,digest(`${id}:${i}`).slice(0,32),b.payload.goal)})),{key:'message',run:()=>executor.send(b.payload.message)}];
  for(const step of steps){
    const old=db.prepare('SELECT status FROM action_results WHERE bundle_id=? AND step=?').get(id,step.key);if(old?.status==='complete')continue;
    db.prepare('INSERT OR REPLACE INTO action_results VALUES (?,?,?,?)').run(id,step.key,'running',null);
    try{
      const receipt=await step.run();
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare("UPDATE action_results SET status='complete',receipt=? WHERE bundle_id=? AND step=?").run(JSON.stringify(receipt),id,step.key);
        db.prepare('INSERT INTO receipts (id,at,kind,decision,title,detail,plan_id) VALUES (?,?,?,?,?,?,?)').run(randomUUID(),new Date().toISOString(),'execute','execute',receipt.kind,JSON.stringify(receipt),id);
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
    }catch(e){
      // A timeout or malformed response might follow a successful remote write.
      // Never retry automatically and risk sending a second message.
      db.prepare("UPDATE action_results SET status='unknown',receipt=? WHERE bundle_id=? AND step=?").run(JSON.stringify({error:'Provider outcome needs reconciliation; no automatic retry.'}),id,step.key);
      db.prepare("UPDATE action_bundles SET state='needs_reconciliation' WHERE id=?").run(id);
      return getBundle(db,id);
    }
  }
  db.prepare("UPDATE action_bundles SET state='complete' WHERE id=?").run(id);return getBundle(db,id);
}
