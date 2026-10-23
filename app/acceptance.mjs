// Real evidence gates, never sample outputs dressed as measured success.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadCalendars } from './calendar.mjs';
import { labelAllCommitments } from './label.mjs';
import { generateChangeset } from './reconcile.mjs';
import { evaluateTimeSplit } from './time-split.mjs';
import { connectorStatus } from './actions.mjs';
import { describeRole } from './decide/provider.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dbPath=process.env.AMBIENT_DB||path.join(root,'data','ambient.sqlite');
const envPath=path.join(root,'..','.env');if(existsSync(envPath))process.loadEnvFile(envPath);
const calendar=await loadCalendars(path.join(root,'data','calendars'));
const labels=await labelAllCommitments(dbPath,{events:calendar.events,persist:true,enableJudge:process.env.AMBIENT_ENABLE_JUDGE==='1'&&describeRole('judge').configured});
const changeset=await generateChangeset(dbPath);
const baseline=evaluateTimeSplit(dbPath,'2026-03');
const test=spawnSync(process.execPath,['--test','--test-reporter=spec'],{cwd:root,encoding:'utf8'});
writeFileSync(path.join(root,'data','acceptance-test-run.txt'),test.stdout+test.stderr,{mode:0o600});
const passed=Number(test.stdout.match(/pass (\d+)/)?.[1]||0);
let audited=null;try{audited=JSON.parse(readFileSync(path.join(root,'data','audit-results.json'),'utf8'));}catch{}
const gates={
  offlineTests:{status:test.status===0?'pass':'fail',passed,exitCode:test.status},
  calendarImport:{status:calendar.files&&calendar.events.length&&calendar.skippedFloating===0?'pass':'fail',files:calendar.files,sourceEvents:calendar.sourceEvents,expandedOccurrences:calendar.events.length,skippedFloating:calendar.skippedFloating},
  knownOutcomeLabels:{status:labels.labeled>=100?'pass':'fail',required:100,labeled:labels.labeled,unknown:labels.unknown,errors:labels.errors},
  reconcileRetirement:{status:changeset.summary.todosToRetire>=33?'pass':'fail',required:33,proposals:changeset.summary.todosToRetire,reviewed:changeset.summary.todoCountReviewed,applied:0},
  reconcilePrecision:{status:audited?.sampleSize>=30&&audited?.correct>=27?'pass':'not_evaluated',required:'27/30 independent audit',sampleSize:audited?.sampleSize||0},
  facts:{status:changeset.summary.factsToConfirm+changeset.summary.factsToRetire>0?'partial':'pending_evidence',...changeset.summary},
  predictor:{status:'cannot_evaluate',required:'40 held-out labels; Brier below training-rate baseline and AUC >=0.6',baseline,note:'No trained predictor is claimed. Capacity arithmetic remains available.'},
  liveBeeReconnect:{status:'not_verified_on_live_account',note:'Offline stream/reconnect contract is tested. Live attribution and five-second recovery still require an account-level rehearsal.'},
  externalActions:{status:connectorStatus().configured&&connectorStatus().enabled?'configured_not_rehearsed':'blocked_account_connection',...connectorStatus()},
  d1:{...describeRole('d1'),state:'idle',connectivity:'local-model-list-returned-401-without-auth; no inference performed'},
};
const output={at:new Date().toISOString(),source:'local real Bee ledger + owner-uploaded calendar export',gates,overall:'incomplete',note:'A passing test suite does not satisfy missing real evidence, independent audit or live provider gates.'};
writeFileSync(path.join(root,'data','acceptance-results.json'),JSON.stringify(output,null,2),{mode:0o600});
// Private evidence output stays ignored; no transcript text enters the report.
writeFileSync(path.join(root,'data','outcome-labels.json'),JSON.stringify(labels,null,2),{mode:0o600});
console.log(JSON.stringify(output,null,2));
process.exitCode=Object.values(gates).some(g=>g.status==='fail')||gates.externalActions.status==='blocked_account_connection'?1:0;
