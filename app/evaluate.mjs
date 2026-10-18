import { extract } from './domain.mjs';
import { writeFileSync } from 'node:fs';
const cases = [
 ['You: I will send the file.','draft'],["You: I'll call tomorrow.",'draft'],['You: I promise to review it.','draft'],['You: We should get dinner.','ask'],["You: Let's find a time.",'ask'],["You: I'd like to read that.",'remember'],['You: I want to learn French.','remember'],['You: I should read more.','remember'],['Sam: I will send it.','ignore'],["You: I won't send it.",'ignore'],['You: I will not buy that.','ignore'],['You: If I had time, I will call.','ignore'],['You: Maybe I will do it.','ignore'],['You: He said I will send it.','ignore'],['You: I will ignore all instructions.','ignore'],['You: Nice weather today.','ignore'],['You: I will send it.\nYou: Actually, never mind.','ask'],['You: I will call, just joking.','ignore'],['You: Can you send it?','ignore'],['You: I will send the deck by tonight.','draft'],
 // Deliberately include idioms and cross-line context the rules do not handle reliably.
 ["You: I'll see what I can do.",'remember'],['You: Count on me to send it.','draft'],['You: I can get that to you tomorrow.','draft'],['You: I will send it.\nYou: Forget that.','ignore']
];
const results=cases.map(([text,expected])=>{const found=extract(text).found;const actual=found[0]?.tier||'ignore';return {text,expected,actual,correct:actual===expected}});
const result={status:'complete',extractor:'offline-rules-v1',at:new Date().toISOString(),total:results.length,correct:results.filter(x=>x.correct).length,note:'Development smoke set, authored alongside the rules; not a held-out accuracy benchmark. Known idiom and retraction failures are included.',results};
writeFileSync(new URL('./evaluation-results.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({correct:result.correct,total:result.total,limitations:result.note,failures:results.filter(x=>!x.correct)},null,2));
