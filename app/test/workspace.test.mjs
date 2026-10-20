import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.mjs';
import { parseIcs } from '../calendar.mjs';
import { labelCommitment, matchCalendar } from '../label.mjs';
import { growSchema, saveGrow, listGrow } from '../grow.mjs';
import { actionSchema, prepareBundle, approveBundle, executeBundle } from '../actions.mjs';
import { judgeFromLaterConversations } from '../label.mjs';
import { consumeStream, processStreamEvent } from '../stream-handler.mjs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const calendar=lines=>['BEGIN:VCALENDAR','VERSION:2.0',...lines,'END:VCALENDAR'].join('\r\n');
const event=['BEGIN:VEVENT','UID:one','DTSTART:20261020T130000Z','DTEND:20261020T140000Z','SUMMARY:Review Project Atlas','CREATED:20261010T130000Z'];
test('calendar expands recurrence, respects exclusion and cancellation',()=>{
 const r=parseIcs(calendar([...event,'RRULE:FREQ=DAILY;COUNT=3','EXDATE:20261021T130000Z','END:VEVENT','BEGIN:VEVENT','UID:cancelled','DTSTART:20261020T130000Z','DTEND:20261020T140000Z','STATUS:CANCELLED','END:VEVENT']));
 assert.equal(r.events.length,2);assert.equal(r.events[1].start,'2026-10-22T13:00:00.000Z');assert.equal(r.events[0].summary,'Review Project Atlas');
});
test('calendar converts embedded timezone and preserves all day exclusive end',()=>{
 const zone=['BEGIN:VTIMEZONE','TZID:America/New_York','BEGIN:DAYLIGHT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','TZOFFSETFROM:-0500','TZOFFSETTO:-0400','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','TZOFFSETFROM:-0400','TZOFFSETTO:-0500','END:STANDARD','END:VTIMEZONE'];
 const r=parseIcs(calendar([...zone,'BEGIN:VEVENT','UID:tz','DTSTART;TZID=America/New_York:20261020T090000','DTEND;TZID=America/New_York:20261020T100000','END:VEVENT','BEGIN:VEVENT','UID:day','DTSTART;VALUE=DATE:20261020','DTEND;VALUE=DATE:20261021','END:VEVENT']));
 assert.equal(r.events[0].start,'2026-10-20T13:00:00.000Z');assert.equal(r.events[1].allDay,true);assert.equal(Date.parse(r.events[1].end)-Date.parse(r.events[1].start),86400000);
});
test('unresolved floating times stay unresolved',()=>{
 const r=parseIcs(calendar(['BEGIN:VEVENT','UID:f','DTSTART:20261020T090000','DTEND:20261020T100000','END:VEVENT']));assert.equal(r.events.length,0);assert.equal(r.skippedFloating,1);
});
test('completion flag alone stays unknown and calendar requires unique scheduling identity',async()=>{
 const c={text:'Send Project Atlas report',created_at:'2026-10-01T12:00:00Z',due_at:'2026-10-20T13:00:00Z',evidence:JSON.stringify({origin:'bee_todo',completed:true})};
 const events=parseIcs(calendar([...event,'END:VEVENT'])).events;
 assert.equal(matchCalendar(c,events),null);assert.equal((await labelCommitment(c,{events})).verdict,'unknown');
 const scheduling={...c,text:'Schedule Project Atlas',evidence:{}};
 assert.equal(matchCalendar(scheduling,events)?.verdict,'done');assert.equal(matchCalendar(scheduling,[...events,...events]),null);assert.equal(matchCalendar({...scheduling,created_at:'2026-10-11T00:00:00Z'},events),null);
});
test('Grow corrections persist with provenance and stale updates fail',()=>{
 const db=openDb(':memory:');growSchema(db);const first=saveGrow(db,{kind:'goal',title:'Launch Friday',detail:'My stated goal',minutes:360,due_at:'2026-10-23T17:00:00-04:00'});
 const next=saveGrow(db,{...first,title:'Ship smaller',state:'paused'});assert.equal(next.version,2);assert.equal(next.evidence.quote,'My stated goal');assert.equal(listGrow(db)[0].title,'Ship smaller');assert.throws(()=>saveGrow(db,{...first,title:'stale'}),/changed/);assert.throws(()=>saveGrow(db,{kind:'goal',title:'No',minutes:-1}),/minutes/);db.close();
});
const payload={executor:'sandbox',goal:'Launch',message:{to:'recipient@example.com',subject:'Timing request',body:'Could we move this to Monday?'},blocks:[{start:'2026-10-22T13:00:00Z',end:'2026-10-22T16:00:00Z'}]};
test('exact approval is required and persistent sandbox receipts are idempotent',async()=>{
 const db=openDb(':memory:');actionSchema(db);const b=prepareBundle(db,payload);await assert.rejects(executeBundle(db,b.id),/approve/);assert.throws(()=>approveBundle(db,b.id,'old'),/changed/);approveBundle(db,b.id,b.hash);
 const r=await executeBundle(db,b.id);assert.equal(r.state,'complete');assert.equal(r.results.find(r=>r.step==='message').receipt.sent,false);assert.equal(db.prepare('SELECT count(*) AS n FROM receipts').get().n,2);await executeBundle(db,b.id);assert.equal(db.prepare('SELECT count(*) AS n FROM receipts').get().n,2);db.close();
});
test('partial provider outcome retains completed hold and blocks re-send',async()=>{
 const db=openDb(':memory:');actionSchema(db);const b=prepareBundle(db,{...payload,executor:'google'});approveBundle(db,b.id,b.hash);let sends=0;
 const adapter={check:async()=>{},hold:async()=>({id:'provider-event',kind:'calendar_hold'}),send:async()=>{sends++;throw new Error('timeout');}};
 const r=await executeBundle(db,b.id,adapter);assert.equal(r.state,'needs_reconciliation');assert.equal(r.results.find(r=>r.step==='hold-0').status,'complete');await assert.rejects(executeBundle(db,b.id,adapter),/approve/);assert.equal(sends,1);db.close();
});
test('concurrent execution dispatches once',async()=>{
 const db=openDb(':memory:');actionSchema(db);const b=prepareBundle(db,payload);approveBundle(db,b.id,b.hash);let holds=0;
 const adapter={check:async()=>{},hold:async()=>{holds++;return{id:'h'}},send:async()=>({id:'m'})};const results=await Promise.allSettled([executeBundle(db,b.id,adapter),executeBundle(db,b.id,adapter)]);assert.equal(holds,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);db.close();
});
test('judge cannot use pre-promise, another speaker or fabricated support',async()=>{
 const c={text:'Send report',quote:'I will send report.',owner:'Owner',created_at:'2026-10-01T00:00:00Z'};
 let calls=0;const judgeClient=async()=>{calls++;return{verdict:'done',observationId:'later',quote:'I sent the report yesterday.'}};
 const observation={id:'later',speaker:'Owner',at:'2026-10-02T00:00:00Z',text:'I sent the report yesterday.'};
 assert.equal((await judgeFromLaterConversations(c,{observations:[{...observation,at:'2026-09-01T00:00:00Z'}],judgeClient})).verdict,'unknown');assert.equal(calls,0);
 assert.equal((await judgeFromLaterConversations(c,{observations:[{...observation,speaker:'Other'}],judgeClient})).verdict,'unknown');assert.equal(calls,0);
 assert.equal((await judgeFromLaterConversations(c,{observations:[observation],judgeClient})).verdict,'done');
 assert.equal((await judgeFromLaterConversations(c,{observations:[{...observation,text:'I plan to send it next week.'}],judgeClient})).verdict,'unknown');
});
test('truncated live stream is recovered once by catch-up within five seconds',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'latent-stream-')),dbPath=path.join(dir,'ledger.sqlite');openDb(dbPath).close();
 const controller=new AbortController();const profile={firstName:'Demo',lastName:'User',timezone:'UTC'};
 const missed={type:'new-utterance',data:{utterance:{id:'missed-event',conversation_id:'conversation',speaker:'Demo User',spoken_at:1792324800000,text:"I'll send the report by Friday.",start:0,end:1}}};
 const start=Date.now();let catchups=0;
 try{
  await consumeStream({dbPath,profile,controller,spawnImpl:()=>{
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('close',0);
    setImmediate(()=>{child.stdout.write('{"type":"new-utterance"');child.emit('close',1)});return child;
  },catchup:async()=>{catchups++;const db=openDb(dbPath);await processStreamEvent(missed,db,{profile});await processStreamEvent(missed,db,{profile});db.close();controller.abort();}});
  const db=openDb(dbPath);assert.equal(db.prepare('SELECT count(*) AS n FROM commitments').get().n,1);db.close();assert.equal(catchups,1);assert.ok(Date.now()-start<5000);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
