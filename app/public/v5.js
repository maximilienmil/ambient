/* Product name in one place. The wordmark reads “ambient” with “bee” in the middle. */
const BRAND = 'Ambeent';
const WORDMARK = '<span class="mark"></span><span class="wm">am<i>·</i><b>bee</b><i>·</i>nt</span>';

const S={mode:'demo',settings:false,heard:false,listen:0,goals:[['Ship the first release','6 h left · due Fri',70,'#fadb4a'],['Run three times a week','2 of 3 this week',66,'#d3c6fa'],['Read before bed','No data yet',0,'#e5e1d4']],sugg:true,mood:null,tags:{},tab:'horizon',path:'A',sheet:false,run:null,sent:false,filter:'done',receipt:null,merged:{},facts:{},split:null,range:'week',toast:null};
const I={
 horizon:'<svg viewBox="0 0 24 24"><path d="M3 17h18M6 17a6 6 0 0 1 12 0M12 5v2M5.5 8.5l1.4 1.4M18.5 8.5l-1.4 1.4"/></svg>',
 compass:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
 rec:'<svg viewBox="0 0 24 24"><path d="M7 4v6a5 5 0 0 0 5 5h5M17 15l-3-3M17 15l-3 3"/><circle cx="7" cy="4" r="1.5"/></svg>',
 mic:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
 mail:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 8 8 6 8-6"/></svg>',
 clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'};
const COL={done:'var(--done)',need:'var(--need)',wait:'var(--wait)',later:'var(--later)'};
const LBL={done:'Done by the hive',need:'Needs you',wait:'Waiting on others',later:'Remembered for later'};
/* overnight items. who: me = you said it, them = someone told you, sys = from a record */
const ITEMS=[
 {id:'merge',via:'Ambeent, on this device',k:'done',t:'Merged 4 copies of “Send Jordan the outline”',who:['sys','Bee to-dos'],src:'Tue 10:14 am, Thu 4:02 pm',
  did:'Kept one to-do, retired three copies. Undo stays available for 30 days.',ev:'Same person, same file, same wording within two days.',q:null,jev:'Merge',d1:'Merge'},
 {id:'dentist',via:'Ambeent, checked against Google Calendar',k:'done',t:'Closed “Book a dentist cleaning”',who:['me','You said it'],src:'Bee conversation, Oct 6',
  q:'I need to book a cleaning before the end of the month.',did:'Marked done in Ambeent. Your Bee to-do is untouched.',ev:'Your calendar shows “Dentist, Oct 17, 9:00 am”, after the conversation.',jev:'Close',d1:'Close'},
 {id:'fact',via:'Bee agent, checked by Ambeent',k:'done',t:'Confirmed a Bee fact: your sister lives in Boston',who:['me','You said it'],src:'2 later conversations, 1 calendar trip',
  q:'My sister just moved to Boston, I’m visiting her in November.',did:'Moved the fact from “to confirm” to confirmed.',ev:'“Boston, visit Ana” on your calendar Nov 8 to 10.',jev:'Confirm',d1:'Confirm'},
 {id:'hold',via:'Google Calendar connector · demo account',k:'done',t:'Held time for “Client call Wednesday at 2”',who:['me','You said it'],src:'Bee conversation, yesterday 5:40 pm',
  q:'Let’s do the client call Wednesday at two.',did:'Private hold on your demo calendar. No invite was sent to anyone.',ev:'The slot was free and the call was your own plan.',jev:'Hold time',d1:'Hold time'},
 {id:'expense',k:'done',via:'Claude, through the Ambeent MCP server',t:'Filed your Lisbon train receipt',who:['me','You said it'],src:'Bee conversation, Sunday 6:20 pm',
  q:'Remind me to file the train receipt.',did:'Another agent picked this up through Ambeent’s MCP tools and filed it in your expenses folder.',ev:'The receipt PDF was in your downloads from Sunday.',jev:'Delegate',d1:'Delegate'},
 {id:'fork',via:'Not yet',k:'need',t:'Release Friday, or help Jordan by Thursday?',who:['me','You said it'],src:'Bee conversation, yesterday 4:12 pm',
  q:'Sure, I’ll help with the deck by Thursday.',did:'Nothing yet. Three paths are ready in Fork the week.',ev:'The release needs 6 hours. This week has 6 open. The favor takes 3.',jev:'Ask to move the favor',d1:'Ask to move the favor'},
 {id:'priya',via:'Not yet',k:'need',t:'The models disagree on “Send Priya the budget”',who:['me','You said it'],src:'Bee conversation, Monday 11:05 am',
  q:'I’ll send you the budget once it’s final.',did:'Nothing yet. Waiting for your call in Reconcile.',ev:'The budget file was edited Sunday. It may not be final.',jev:'Draft it now',d1:'Ask first'},
 {id:'slides',via:'Nobody. Not your promise',k:'wait',t:'Priya said she’d send the slides by Monday',who:['them','Priya said it'],src:'Bee conversation, Monday 11:07 am',
  q:'I’ll get you the slides by Monday.',did:'Remembered only. Ambeent never acts on someone else’s promise.',ev:'Speaker attribution: Priya, not you.',jev:'Remember',d1:'Remember'},
 {id:'venue',via:'Nobody. Not your promise',k:'wait',t:'Sam owes you a reply about the venue',who:['them','Sam said it'],src:'Bee conversation, Sunday',
  q:'Let me check with the venue and get back to you.',did:'Remembered. If nothing arrives by Friday, Ambeent will ask whether to nudge.',ev:'Speaker attribution: Sam.',jev:'Remember',d1:'Remember'},
 {id:'rust',via:'Nobody yet',k:'later',t:'“Learn Rust someday”',who:['me','You said it'],src:'Bee conversation, Sep 30',
  q:'I really want to learn Rust someday.',did:'Remembered, not scheduled. No date or next step was agreed.',ev:'An aspiration with no time attached.',jev:'Remember',d1:'Remember'}
];
const JORDAN={id:'jordan',via:'Gmail and Google Calendar connectors · demo account',k:'wait',t:'Jordan: reply about moving the deck to Monday',who:['them','Waiting on Jordan'],src:'Sent from your demo account, 7:02 am',
 q:null,did:'Asked Jordan to move the deck help to Monday. Jordan has not agreed yet.',ev:'Message delivered. 2 holds on your demo calendar.',jev:'Ask to move the favor',d1:'Ask to move the favor'};
function counts(){const c={done:17,need:0,wait:1,later:3};items().forEach(i=>c[i.k]++);return c}
function items(){return ITEMS.map(i=>i.id=='fork'&&S.sent?null:i.id=='priya'&&S.split?{...i,k:'done',t:'Drafted “Send Priya the budget”',did:'You chose: '+S.split+'.'}:i).filter(Boolean).concat(S.sent?[JORDAN]:[])}
function ringDemo(){
 const c=counts(),tot=Object.values(c).reduce((a,b)=>a+b,0),R=62,C=2*Math.PI*R,gap=4;let off=0;
 const segs=['done','need','wait','later'].map(k=>{const len=Math.max(0,c[k]/tot*C-gap);const s=`<circle cx="75" cy="75" r="${R}" fill="none" stroke="${COL[k]}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len} ${C}" stroke-dashoffset="${-off}"/>`;off+=c[k]/tot*C;return s}).join('');
 return `<div class="ringcard glass"><div class="ring"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="${R}" fill="none" stroke="#ffffff70" stroke-width="14"/>${segs}</svg>
  <div class="ctr"><div><b>${c.need}</b><span>need${c.need==1?'s':''} you</span></div></div></div>
  <div class="legend">${['done','need','wait','later'].map(k=>`<button class="lg" data-filter="${k}" aria-pressed="${S.filter==k}"><i style="background:${COL[k]}"></i>${{done:"Done",need:"Needs you",wait:"Waiting",later:"Later"}[k]}<b>${c[k]}</b></button>`).join('')}
  <div class="more" style="padding:2px 10px">${tot} things from Bee overnight</div></div></div>`}
function feedDemo(){
 const list=items().filter(i=>i.k==S.filter);
 return `<div class="blk w" id="feed">${lbl(S.filter,{done:"The hive did",need:"Needs you",wait:"Waiting on others",later:"Remembered"}[S.filter])}<h2>${S.filter=='done'?'While you slept':LBL[S.filter]}</h2><p class="sub">${{done:'Small, safe things handled overnight. Tap any one for its receipt.',need:'Only what really needs your judgment.',wait:'Promises other people made. Ambeent remembers and waits.',later:'Kept, not scheduled.'}[S.filter]}</p>
 ${list.map(i=>`<button class="item" data-receipt="${i.id}"><span class="sd" style="background:${COL[i.k]}"></span><div style="min-width:0"><div class="t">${i.t}</div><div class="s"><span class="who ${i.who[0]}">${i.who[1]}</span>${i.src}</div>${i.k=='done'?`<div class="via">via ${i.via}</div>`:''}</div><span class="go2">Receipt ›</span></button>`).join('')}
 ${S.filter=='done'?`<p class="more">and 18 more like these: duplicates merged, done items closed.</p>`:''}</div>`}
const P={
 A:{n:'Protect the launch',s:'Ask Jordan to move the favor to Monday. Release ships Friday.',tag:'Release stays Friday',
  d:{Mon:[['mtg','Standup']],Tue:[['rel','Release 9 to 12']],Wed:[['mtg','Client call']],Thu:[['rel','Release 9 to 12']],Fri:[['due','Ships']],N:[['jor','Jordan deck 9 to 12']]},
  h:['rel','rel','rel','rel','rel','rel'],big:'6 of 6',fit:'All release hours fit before Friday. Jordan’s deck moves to Monday, if Jordan agrees.',
  why:'Ask to move the favor, not drop it.',body:'You set Friday for yourself and the release needs every open hour. Monday still lands two days before Jordan’s Wednesday pitch.',
  act:'Review message to Jordan',sh:[['From','Your demo account'],['To','Jordan'],['Message','Hi Jordan, I want to do the deck properly, but I’m shipping a release Friday. Could I give you Monday morning instead? That’s still well before your Wednesday pitch.'],['Time held','Tue 9 to 12 and Thu 9 to 12 for release work']],
  go:'Send and hold time',via:'Gmail and Google Calendar connectors',steps:['Writing from your demo account','Sent to Jordan','Held Tuesday 9 to 12','Held Thursday 9 to 12']},
 B:{n:'Keep the favor',s:'Help Jordan Tuesday. Release moves to next Monday.',tag:'Release slips to Monday',
  d:{Mon:[['mtg','Standup']],Tue:[['jor','Jordan deck 9 to 12']],Wed:[['mtg','Client call']],Thu:[['rel','Release 9 to 12']],Fri:[['mtg','Not ready']],N:[['rel','Release 9 to 12'],['due','Ships']]},
  h:['rel','rel','rel','jor','jor','jor'],big:'3 of 6',fit:'Only 3 release hours fit this week. The other 3 move to Monday, and so does shipping.',
  why:'Keep your word, move your own date.',body:'If Jordan’s deadline can’t move, your own date is the easier one to shift. Nobody else is waiting on Friday.',
  act:'Review the new plan',sh:[['Change','Ship date moves from Fri Oct 23 to Mon Oct 26'],['Time held','Tue 9 to 12 for Jordan, Thu and Mon 9 to 12 for release']],
  go:'Hold time',steps:['Opening your demo calendar','Held Tuesday 9 to 12 for Jordan','Held Thursday 9 to 12','Held Monday 9 to 12']},
 C:{n:'Ship a smaller release',s:'Help Jordan Tuesday and ship less on Friday.',tag:'Billing and onboarding wait',
  d:{Mon:[['mtg','Standup']],Tue:[['jor','Jordan deck 9 to 12']],Wed:[['mtg','Client call']],Thu:[['rel','Release 9 to 12']],Fri:[['due','Small ship']],N:[['rel','Billing, onboarding']]},
  h:['rel','rel','rel','jor','jor','jor'],big:'3 of 3',fit:'The smaller release fits. Billing and onboarding move to next week.',
  why:'Both promises, a smaller release.',body:'Only worth it if a first release without billing and onboarding is still worth shipping. That’s your call.',
  act:'Review the smaller scope',sh:[['Friday','Sign-up, core flow, export'],['Next Monday','Billing, onboarding']],
  go:'Save scope and hold time',steps:['Saving the smaller scope','Held Tuesday 9 to 12 for Jordan','Held Thursday 9 to 12']}
};

const ico={merge:'<svg viewBox="0 0 24 24"><path d="M7 4v6a5 5 0 0 0 5 5h5M17 15l-3-3M17 15l-3 3"/></svg>',check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg>',cal:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',fact:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16v.5"/></svg>'};
const FACES=[['Drained','#f6a58a,#ef7b62','M8 16c2-2 6-2 8 0'],['Stretched','#d9c8f7,#b39be8','M8 15.5c2-1.2 6-1.2 8 0'],['Steady','#b9d4f6,#7fa9ea','M8 15h8'],['Good','#fbe58a,#f2c94a','M8 14c2 2 6 2 8 0'],['Light','#bfeccb,#6fcf8f','M7.5 13.5c2 3 7 3 9 0']];
const LC={need:'var(--need)',done:'var(--done)',wait:'var(--wait)',later:'var(--later)',ink:'#fadb4a'};
const lbl=(k,t)=>`<div class="lbl"><i style="background:${LC[k]}"></i>${t}</div>`;
const ev=l=>l.map(([c,t])=>`<div class="ev ${c}">${t}</div>`).join('');
function fork(){
 const E={A:[28,'Ships Friday'],B:[78,'Ships Monday'],C:[128,'Smaller, Friday']};
 return `<svg viewBox="0 0 520 156" style="width:100%;display:block;margin:0 0 12px" role="img" aria-label="Three paths from today">
  ${Object.entries(E).map(([k,[y,t]])=>{const on=S.path==k;return `<g data-path="${k}" style="cursor:pointer"><path d="M44 78C150 78 190 ${y} 300 ${y}" fill="none" stroke="${on?'#6a3fe6':'#ffffff'}" stroke-width="${on?5:3}" stroke-linecap="round" opacity="${on?1:.75}"/><circle cx="300" cy="${y}" r="${on?9:6}" fill="${on?'#6a3fe6':'#fff'}"/><text x="316" y="${y+4}" font-size="19" font-family="Geist" font-weight="${on?700:500}" fill="#17160a">${k} · ${t}</text></g>`}).join('')}
  <circle cx="44" cy="78" r="12" fill="#17160a"/><text x="44" y="122" font-size="16" font-family="Geist" font-weight="600" text-anchor="middle" fill="#17160a">Today</text></svg>`}
function forkM(){
 const E={A:[28,'Ships Friday'],B:[78,'Ships Monday'],C:[128,'Smaller, Friday']};
 return `<svg viewBox="0 0 330 156" style="width:100%;display:block;margin:0 0 12px" role="img" aria-label="Three paths from today">
  ${Object.entries(E).map(([k,[y,t]])=>{const on=S.path==k;return `<g data-path="${k}" style="cursor:pointer"><path d="M30 78C100 78 120 ${y} 170 ${y}" fill="none" stroke="${on?'#6a3fe6':'#ffffff'}" stroke-width="${on?5:3}" stroke-linecap="round" opacity="${on?1:.75}"/><circle cx="170" cy="${y}" r="${on?9:6}" fill="${on?'#6a3fe6':'#fff'}"/><text x="184" y="${y+4}" font-size="17" font-family="Geist" font-weight="${on?700:500}" fill="#17160a">${k} · ${t}</text></g>`}).join('')}
  <circle cx="30" cy="78" r="12" fill="#17160a"/><text x="30" y="122" font-size="14" font-family="Geist" font-weight="600" text-anchor="middle" fill="#17160a">Today</text></svg>`}
function liveDemo(){
 const q='Sure, I’ll help with the deck by Thursday.',n=S.listen?Math.min(q.length,Math.floor(S.listen)):0;
 return `<div class="blk o live">${lbl('ink',S.listen?'Hearing a new promise':'Listening through Bee')}
  
  ${S.listen?`<div class="said"><span class="who me">You said it</span><span class="typed">“${q.slice(0,n)}<b class="caret"></b>”</span></div><p>Attributed to you in the captured event. Checking it against your calendar.</p>`
  :`<p>Nothing new yet. For the demo, replay the promise Bee captured yesterday at 4:12 pm.</p><div class="act"><button class="chip" data-replay>${I.mic||''}Replay captured promise</button></div>`}</div>`}
function decideDemo(){
 const p=P[S.path];
 if(S.sent)return `<div class="result"><div class="sec" style="margin-top:0">DONE BY THE HIVE · 7:02 AM</div><div class="rt">${S.path=='A'?'Asked Jordan to move the deck to Monday.':S.path=='B'?'Your week now keeps the favor.':'The smaller release is set.'}</div>
  <div class="kv">${S.path=='A'?'<span>Message</span><div>Delivered from your demo account</div>':''}<span>Done by</span><div>${p.via||'Google Calendar connector'}</div><span>Calendar</span><div>${p.steps.filter(x=>x.startsWith("Held")).length} holds on your demo calendar</div><span>Status</span><div>${S.path=='A'?'Waiting on Jordan. A request is not a yes.':'Done. You can undo the holds.'}</div></div>
  <div class="act"><button class="chip" data-receipt="jordan">Receipt</button><button class="chip" data-undo-run>Undo</button></div></div>`;
 if(S.run!=null)return `<div class="run"><div class="lane">${[0,1,2,3].map(i=>`<span style="animation-delay:${-i*.55}s">\\(◉)/ · ·</span>`).join('')}</div>
  ${p.steps.map((s,i)=>`<div class="step ${i<S.run?'ok':i==S.run?'cur':''}"><span class="ck">${i<S.run?'✓':''}</span>${s}</div>`).join('')}</div>`;
 return `<div class="act"><button class="chip ${S.sheet?'on':''}" data-sheet>${S.path=='A'?I.mail:I.clock}${p.act}</button></div>
  ${S.sheet?`<div class="sheet">${p.sh.map(([a,b])=>`<label>${a}</label><div class="f">${b}</div>`).join('')}<button class="go" data-go>${p.go}</button><p class="fine">${S.path=='A'?'Jordan still has to agree. ':''}The hive does this through ${S.path=='A'?'Gmail and Google Calendar':'Google Calendar'} on your demo account, and you can undo it.</p></div>`:''}`}
function horizonDemo(){
 const p=P[S.path],m=S.path=='A';
 return `<section class="hero"><canvas data-swarm></canvas>${topBar()}
  <div class="row"><div class="txt"><h1>The hive is working<br>through your week.</h1>
  <p>Overnight the hive <span class="ii">${ico.merge}merged 4 duplicates</span>, <span class="ii">${ico.check}closed 2 done to-dos</span>, <span class="ii">${ico.fact}confirmed a fact</span> and <span class="ii">${ico.cal}held time for a call</span>. ${counts().need==1?'One decision is':counts().need+' decisions are'} yours.</p>${ringDemo()}</div></div></section>
 <div class="wrap"><div class="col">
  ${!S.heard?liveDemo():S.sent?'':`<div class="blk y pop">${lbl('need','Needs you')}<h2>Release Friday, or help Jordan by Thursday?</h2><p class="sub" style="margin:0;color:#4b4825">You told Jordan you’d help with a presentation. It takes time the release needs.</p>
   <div class="stats"><div class="stat"><b>6h</b><span>the release still needs</span></div><div class="stat"><b>6h</b><span>open focus time</span></div><div class="stat neg"><b>−3h</b><span>Jordan’s favor takes</span></div></div></div>`}
  ${S.heard?'':'<div class="ghost">'}<div class="blk l ${S.heard?'pop2':''}">${lbl('wait','Your choice')}<h2>Fork the week</h2><p class="sub">Three ways this week can go. Pick one to see the plan.</p>
   <div class="fkd">${fork()}</div><div class="fkm">${forkM()}</div>
   ${Object.entries(P).map(([k,x])=>`<button class="opt ${k=='C'?'c':''}" aria-pressed="${S.path==k}" data-path="${k}"><span class="rad">${k}</span><div><b>${x.n}</b><span>${x.s}</span><em class="tag" style="font-style:normal">${x.tag}</em></div></button>`).join('')}
   <div class="blk w" style="margin-top:14px;padding:16px"><div style="font-weight:600;margin-bottom:10px">Your week with ${S.path}</div>
   <div class="week">${['Mon','Tue','Wed','Thu','Fri','N'].map(d=>`<div class="day ${d=='N'?'hide-m':''}"><b>${d=='N'?'Next Mon':d}</b>${ev(p.d[d]||[])}</div>`).join('')}</div>
   <div class="leg"><span><i style="background:var(--yel)"></i>Release</span><span><i style="background:var(--lil)"></i>Jordan’s deck</span><span><i style="background:#e5e1d4"></i>Meetings</span></div></div></div>${S.heard?'':'</div>'}
 </div><div class="col sticky ${S.heard?'':'ghost'}">
  <div class="blk o">${lbl('ink','Release hours this week')}<div class="hrs">${p.h.map(x=>`<i class="${x}"></i>`).join('')}</div><div class="big">${p.big}<small>hours</small></div><p>${p.fit}</p></div>
  <div class="blk ${S.sent?'w':'y'}">${S.sent?lbl('done','The hive did'):lbl('need','Recommended')}<h2>${p.why}</h2><p style="margin:6px 0 0;font-size:15px;color:#3b3818">${p.body}</p>
   <div class="models"><span class="mdl">Jev <b>A</b></span><span class="mdl">System One <b>A</b></span><span class="mdl ${m?'agree':'split'}">${m?'Both agree':'You picked '+S.path+'. Your call.'}</span></div>
   ${decideDemo()}</div>
 </div><div class="span">${feedDemo()}</div></div>`}
/* compass */
function hive(){
 const cols=13,rows=4,r=17,w=r*Math.sqrt(3);let out='',n=0;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=x*rows+y,v=[3,0,5,8,2,9,12,7,4,10,14,6,11,9,13,5,1,8,15,12,7,10,16,9,6,13,11,4,8,14,12,17,10,9,15,13,11,7,16,18,12,14,10,19,15,13,17,20,16,18,21,19][i]||0;
  const cx=w/2+x*w+(y%2?w/2:0)+4,cy=r+y*r*1.5+4;const pts=[0,1,2,3,4,5].map(k=>{const a=Math.PI/180*(60*k-30);return (cx+(r-1.5)*Math.cos(a)).toFixed(1)+','+(cy+(r-1.5)*Math.sin(a)).toFixed(1)}).join(' ');
  const t=v/21,fill=v==0?'#ffffff':`rgba(${Math.round(250-40*t)},${Math.round(219-60*t)},${Math.round(74+150*t)},${.35+t*.65})`;
  out+=`<polygon class="cellin" style="animation-delay:${(x*rows+y)*18}ms;transform-origin:${cx}px ${cy}px" points="${pts}" fill="${fill}" stroke="#ffffffaa" stroke-width="1.5"/>`;n++}
 return `<svg class="hex" viewBox="0 0 ${cols*w+w/2+8} ${rows*r*1.5+r+8}" role="img" aria-label="Hive of weekly conversations">${out}</svg>`}
function wave(){const v=[2,3,1,0,2,3,3,1,0,0,2,3,2,1,0,0,3,3,2,2,1],w=300,h=80,pts=v.map((y,i)=>[i*w/(v.length-1),h-10-y*20]);
 let d=`M${pts[0]}`;for(let i=1;i<pts.length;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i],cx=(x0+x1)/2;d+=` C${cx},${y0} ${cx},${y1} ${x1},${y1}`}
 const t=pts[4];return `<svg class="wave" viewBox="-6 -24 312 120"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fadb4a" stop-opacity=".55"/><stop offset="1" stop-color="#fadb4a" stop-opacity="0"/></linearGradient></defs><path d="${d} L300,${h} L0,${h}Z" fill="url(#wg)"/><path d="${d}" fill="none" stroke="#fadb4a" stroke-width="2.2"/><line x1="${t[0]}" y1="${t[1]}" x2="${t[0]}" y2="${h}" stroke="#fadb4a" stroke-dasharray="3 3"/><circle cx="${t[0]}" cy="${t[1]}" r="5" fill="#1d1c0b" stroke="#fadb4a" stroke-width="2.5"/><rect x="${t[0]-26}" y="${t[1]-28}" width="52" height="20" rx="10" fill="#fadb4a"/><text x="${t[0]}" y="${t[1]-14}" text-anchor="middle" font-size="11" font-weight="700" font-family="Geist" fill="#1d1c0b">Today</text><text x="0" y="${h+14}" font-size="10" fill="#cbc7a8" font-family="Geist">Oct 17</text><text x="300" y="${h+14}" font-size="10" fill="#cbc7a8" font-family="Geist" text-anchor="end">Oct 31</text></svg>`}
function compassDemo(){
 const R={week:`<div class="blk o">${lbl("ink","Focus time this week")}<div class="big" style="margin-top:8px">6<small>hours open</small></div><p>Tuesday and Thursday mornings. The release needs all of it.</p></div>`,
  month:`<div class="blk o">${lbl("ink","Focus time left in October")}<div class="big" style="margin-top:8px">~22<small>hours</small></div>${wave()}<p>If two mornings a week stay clear. That’s an assumption you can change.</p><div class="act"><button class="chip">2 mornings a week</button><button class="chip">Edit</button></div></div>`,
  year:`<div class="blk o">${lbl("ink","Patterns across the year")}<div class="big" style="margin-top:8px">3<small>launch weeks crowded by favors</small></div><p>Seen, not predicted. Ambeent shows patterns here, not forecasts, until there’s more to go on.</p></div>`}[S.range];
 const g=S.goals;
 return `<section class="hero" style="min-height:220px"><canvas data-swarm></canvas>${topBar()}<h1>Where your time<br>is heading.</h1><p>Your goals in your words, against what your calendar can hold.</p>
  <div class="seg2 glass">${['week','month','year'].map(k=>`<button aria-pressed="${S.range==k}" data-range="${k}">${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div></section>
 <div class="wrap"><div class="col">
  <div class="blk y">${lbl('need','Needs you · one tap a day')}<h2>How did yesterday feel?</h2>
  <div class="faces">${FACES.map(([n,c,m],i)=>`<button class="face" aria-pressed="${S.mood==i}" data-mood="${i}" aria-label="${n}" style="background:radial-gradient(circle at 35% 30%,${c.split(',')[0]},${c.split(',')[1]})"><svg viewBox="0 0 24 24"><path d="${m}"/></svg></button>`).join('')}</div>
  <div class="tagrow">${['Busy','Scattered','Focused','Social','Rested','Rushed'].map(t=>`<button class="tg2" aria-pressed="${!!S.tags[t]}" data-tag2="${t}">${t}</button>`).join('')}</div>
  <p class="fine">${S.mood==null?'One tap. Ambeent uses it to size tomorrow, never to grade you.':S.mood<2?'Got it. Ambeent will keep tomorrow lighter and hold one morning free.':'Got it. Tomorrow keeps its current plan.'}</p></div>
  <div class="blk l">${lbl('wait','Your choice')}<h2>Goals</h2><p class="sub" style="color:#4a3f78">Tap to rename. Ambeent suggests; you decide.</p>
  ${g.map(([a,b,pc,c])=>`<div class="goal"><div class="ring" style="width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;font-weight:700;background:conic-gradient(var(--pur) ${pc*3.6}deg,${c} 0)"><span style="background:#fff;width:34px;height:34px;border-radius:50%;display:grid;place-items:center">${pc}%</span></div><div style="flex:1;min-width:0"><input value="${a}" aria-label="Goal"><div style="color:var(--mut);font-size:13px">${b}</div></div></div>`).join('')}
  ${S.sugg?`<div class="sugg"><div class="lbl" style="margin-bottom:4px"><i style="background:var(--later)"></i>Ambeent noticed</div><b>You’ve spent most Sunday mornings on guitar for two months.</b><div style="font-size:14px;color:var(--mut);margin-top:2px">You never set it as a goal. Want to?</div><div class="act" style="margin-top:10px"><button class="chip on" data-sugg="add">Add “Play guitar”</button><button class="chip" data-sugg="no">Not a goal</button></div></div>`:''}
  <div class="act"><button class="chip">${I.plus}Add a goal</button></div></div>
</div>
 <div class="col sticky">${R}
  <div class="blk w">${lbl('later','Observed')}<h2>A pattern, maybe.</h2><p style="margin:6px 0 0;font-size:15px;color:#3b3818">In weeks you said yes to two favors, your own work moved. Is that the trade you want?</p><div class="act"><button class="chip">That’s not right</button><button class="chip">Ask a follow-up</button></div></div></div>
 <div class="span"><div class="blk w">${lbl('done','The hive')}<h2>The hive grows with every conversation.</h2><p class="sub">Each cell is a week. The more Bee heard, the fuller the cell, and the firmer Ambeent’s read on that week.</p>${hive()}
   <div class="leg" style="justify-content:space-between"><span>Oct 2025</span><span>334 conversations · 41 of 52 weeks with enough to go on</span><span>Oct 2026</span></div></div></div></div>`}
/* reconcile */
function recDemo(){
 const pairs=[['Send Jordan the project outline','Tue 10:14 am','Send outline to Jordan','Thu 4:02 pm','Same person, same file, two days apart.'],['Book dentist','Mon 9:30 am','Call dentist to book','Wed 12:10 pm','Both mention the cleaning.']];
 const facts=[['Your sister lives in Boston','2 later conversations and a Boston trip on your calendar'],['You run on Tuesdays','4 of the last 6 Tuesdays have a run on your calendar']];
 const open=130-Object.keys(S.merged).length;
 return `<section class="hero" style="min-height:220px"><canvas data-swarm></canvas>${topBar()}<h1>Keep what<br>holds up.</h1><p>The hive checks Bee’s to-dos and facts against what actually happened. You only see what it can’t settle.</p>
  <div class="count">${open<130?"<s>130</s>":""}${open}<span style="font:600 14px Geist;margin-left:10px;color:#4b4825">open to-dos</span></div></section>
 <div class="wrap">
  ${S.split?'':`<div class="blk y span" style="border:2px solid var(--need)">${lbl('need','Needs you')}<h2>The models disagree.</h2><p class="sub" style="color:#4b4825">“Send Priya the budget.” You said it, so the hive could act. But should it?</p>
   <div class="models" style="margin-top:0"><span class="mdl">Jev <b>Draft it now</b></span><span class="mdl">System One <b>Ask first, the file may not be final</b></span><span class="mdl split">Split</span></div>
   <div class="act"><button class="chip on" data-split="let the hive draft it">Let the hive draft it</button><button class="chip" data-split="you’ll do it yourself">I’ll do it</button></div></div>`}
  <div class="blk l">${lbl('wait','Proposed · duplicates')}<h2>Likely the same task</h2><p class="sub" style="color:#4a3f78">Merging is local and you can undo it.</p>
  ${pairs.map(([a,at,b,bt,why],i)=>S.merged[i]?`<div class="card" style="margin-bottom:10px;display:flex;align-items:center;gap:10px"><span class="dot"></span><div style="flex:1">Merged into one: <b>${a}</b></div><button class="chip" data-unmerge="${i}">Undo</button></div>`:`<div class="card" style="margin-bottom:10px"><div class="pair"><div class="card" style="background:#f6f3ea">${a}<small>Bee to-do · ${at}</small></div><div class="card" style="background:#f6f3ea">${b}<small>Bee to-do · ${bt}</small></div></div><p class="fine">${why}</p><div class="act" style="margin-top:8px"><button class="chip on" data-merge="${i}">Merge into one</button><button class="chip">Keep both</button></div></div>`).join('')}</div>
  <div class="blk w">${lbl('wait','Proposed · facts')}<h2>Facts to confirm</h2><p class="sub">Bee saved 248 facts it isn’t sure about. The hive checks them against your calendar and later conversations.</p>
  ${facts.map(([f,e],i)=>`<div class="card" style="background:#f6f3ea;margin-bottom:8px">${S.facts[i]?`<span class="dot" style="display:inline-block;margin-right:8px"></span>${S.facts[i]}: `:''}${f}<small>${e}</small>${S.facts[i]?'':`<div class="act" style="margin-top:8px"><button class="chip on" data-fact="${i}" data-v="Confirmed">Confirm</button><button class="chip" data-fact="${i}" data-v="Removed">Not true</button></div>`}</div>`).join('')}</div>
  <div class="span note"><b style="color:var(--ink)">Who said it decides what the hive may do.</b><span class="who me">You said it</span>it can act for you.<span class="who them">Someone told you</span>it only remembers. Unsure speaker means Ambeent asks.</div>
 </div>`}
function receiptDemo(){
 const i=items().concat([JORDAN]).find(x=>x.id==S.receipt);if(!i)return'';
 const agree=i.jev==i.d1;
 return `<div class="scrim" data-close><div class="rc" role="dialog" aria-label="Receipt"><button class="x" data-close aria-label="Close">✕</button>
  <span class="who ${i.who[0]}">${i.who[1]}</span><h3>${i.t}</h3>
  ${i.q?`<div class="quote ${i.who[0]=='them'?'them':''}">“${i.q}”</div>`:''}
  <div class="kv"><span>Source</span><div>${i.src}</div><span>Evidence</span><div>${i.ev}</div><span>What happened</span><div>${i.did}</div><span>Done by</span><div><b>${i.via}</b></div></div>
  <div class="sec">DECISION MODELS</div><div class="models" style="margin-top:0"><span class="mdl" style="background:#f1eee4">Jev <b>${i.jev}</b></span><span class="mdl" style="background:#f1eee4">System One <b>${i.d1}</b></span><span class="mdl ${agree?'agree':'split'}">${agree?'Agree':'Split, so you decide'}</span></div>
  ${i.k=='done'?'<div class="act"><button class="chip" data-close>Undo</button></div>':''}</div></div>`}
/* ===================================================================
   Live mode: the same three screens, built from the local ledger.
   Nothing here invents a number. Missing data and unconnected models
   are shown as missing.
   =================================================================== */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const D = { ready: false, token: null, ws: null, ledger: null, rec: null, models: null, synthetic: true, error: null, known: null, heard: null, cmp: null, cmpKey: null, cmpError: null, ask: null, bundle: null, busy: null, msg: null, sync: null, test: {}, saveMsg: {}, scoreMsg: null };
const L = { filter: 'need', focus: null, fMin: 120, fDue: null, goalId: null, gTitle: '', gHours: 6, gDue: 4, path: 'A', sheet: false, run: null, to: '', subject: null, body: null, exec: null, undo: [], factShow: 6, newGoal: false, live: 0 };
const GEAR = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>';

async function api(path, body) {
  const res = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Latent-Token': D.token || '' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

async function boot() {
  render();
  try {
    const session = await api('/api/session');
    D.token = session.token;
    D.ws = await api('/api/workspace');
    D.synthetic = Boolean(D.ws.synthetic || session.preview);
    D.models = await api('/api/models');
    if (!D.synthetic) {
      await loadLedger();
      D.known = new Set(D.ledger.items.map((i) => i.id));
      api('/api/reconcile').then((r) => { D.rec = r; render(); }).catch((e) => { D.rec = { error: e.message }; render(); });
    }
  } catch (e) {
    D.error = e.message;
  }
  D.ready = true;
  const want = new URLSearchParams(location.search).get('mode') || localStorage.getItem('latent-mode');
  S.mode = !D.synthetic && want === 'live' ? 'live' : 'demo';
  render();
  setInterval(poll, 8000);
}

async function loadLedger() {
  D.ledger = await api('/api/ledger');
  if (!L.focus) L.focus = pickFocus()?.id || null;
}

/* New rows appearing in the ledger are the live trigger: `npm run stream`
   or a Bee sync writes them, and the hive reacts here. */
async function poll() {
  if (S.mode !== 'live' || D.synthetic || document.hidden) return;
  try {
    const before = D.known || new Set();
    const sig = (l) => l ? `${l.lastRun}|${l.items.length}|${JSON.stringify(l.stats)}` : '';
    const was = sig(D.ledger);
    await loadLedger();
    if (sig(D.ledger) === was) return;
    const fresh = D.ledger.items.filter((i) => !before.has(i.id) && i.origin === 'conversation');
    D.known = new Set(D.ledger.items.map((i) => i.id));
    if (fresh.length) hear(fresh.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]);
    else if (!busyTyping() && !S.settings) renderQuiet();
  } catch { /* the next poll retries */ }
}

function hear(item) {
  D.heard = item; L.live = 1; SPEED = 3; render();
  const q = String(item.quote || item.title);
  const t = setInterval(() => {
    L.live += 3;
    typeTo(q, L.live);
    if (L.live >= q.length) { clearInterval(t); setTimeout(() => { SPEED = 1; L.live = 0; renderQuiet(); }, 1200); }
  }, 50);
}

/* ---------- reading the ledger ---------- */
const litems = () => D.ledger?.items || [];
const slipIds = () => new Set((D.ledger?.today?.likelyToSlip || []).map((s) => s.id));
function catOf(i) {
  if (i.state === 'done' || i.state === 'obsolete') return 'done';
  if (i.origin === 'bee_todo') return 'need';
  if (i.rule === 'shared-intent') return 'wait';
  return 'later';
}
const dueSort = (a, b) => (b.dueAt || '').localeCompare(a.dueAt || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
function reasonOf(i) {
  if (i.origin !== 'bee_todo') return '';
  if (!i.dueAt) return 'No date in Bee';
  const due = Date.parse(i.dueAt);
  return due < Date.now() ? `Was due ${md(due)}. Close it, move it, or let it go.` : `Due ${md(due)}`;
}
function whoOf(i) {
  if (i.rule === 'first-person-promise') return ['me', 'First person'];
  if (i.rule === 'shared-intent') return ['them', '“We” · shared'];
  if (i.rule === 'stated-interest') return ['me', 'Stated interest'];
  if (i.origin === 'bee_todo') return ['sys', 'Bee to-do'];
  return ['sys', 'Recorded'];
}
const LIVE_LBL = { done: 'Done', need: 'Your to-dos', wait: 'Shared', later: 'Heard' };
function liveCounts() {
  const c = { done: 0, need: 0, wait: 0, later: 0 };
  for (const i of litems()) c[catOf(i)]++;
  return c;
}
function pickFocus() {
  const open = litems().filter((i) => i.state === 'live');
  const todos = open.filter((i) => i.origin === 'bee_todo').sort(dueSort);
  return todos[0] || open[0] || null;
}
const focusItem = () => litems().find((i) => i.id === L.focus) || pickFocus();

/* ---------- time ---------- */
const pad = (n) => String(n).padStart(2, '0');
function isoLocal(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${s}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
function at(ms, h) { const d = new Date(ms); d.setHours(h, 0, 0, 0); return d.getTime(); }
const wd = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });
const md = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
function hm(ms) { const d = new Date(ms); const h = d.getHours() % 12 || 12; return d.getMinutes() ? `${h}:${pad(d.getMinutes())}` : `${h}`; }
const span = (a, b) => `${hm(a)} to ${hm(b)}`;
const hrs = (min) => { const h = min / 60; return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`; };
/** Weekday working windows from now until `to`, 9 to 5 local. An assumption, stated in the UI. */
function availability(to) {
  const now = Date.now(), out = [];
  for (let d = dayStart(now); d < to; d = addDays(d, 1)) {
    const wday = new Date(d).getDay();
    if (wday === 0 || wday === 6) continue;
    const s = Math.max(at(d, 9), now), e = Math.min(at(d, 17), to);
    if (e > s) out.push({ start: isoLocal(s), end: isoLocal(e) });
  }
  return out;
}
const calEvents = () => (D.ws?.calendar?.events || []).filter((e) => e.start && e.end && !e.allDay && Date.parse(e.end) > Date.now() - 864e5 && Date.parse(e.start) < Date.now() + 40 * 864e5);
function freeMinutes(from, to) {
  const busy = calEvents().map((e) => [Date.parse(e.start), Date.parse(e.end)]).filter(([s, e]) => e > s);
  let total = 0;
  for (const w of availability(to)) {
    let s = Math.max(Date.parse(w.start), from), e = Date.parse(w.end);
    if (e <= s) continue;
    let mins = (e - s) / 6e4;
    for (const [bs, be] of busy) mins -= Math.max(0, (Math.min(e, be) - Math.max(s, bs)) / 6e4);
    total += Math.max(0, mins);
  }
  return Math.round(total);
}

/* ---------- the fork: three variants through the real capacity engine ---------- */
function goalOf() {
  const goals = (D.ws?.grow || []).filter((g) => g.kind === 'goal' && g.state === 'active' && g.due_at && g.minutes);
  return goals.find((g) => g.id === L.goalId) || goals[0] || null;
}
function fDue() {
  const f = focusItem();
  if (L.fDue) return L.fDue;
  if (f?.dueAt && Date.parse(f.dueAt) > Date.now()) return Date.parse(f.dueAt);
  return at(addDays(Date.now(), 3), 17);
}
async function compute() {
  const g = goalOf(), f = focusItem();
  if (!g || !f) { D.cmp = null; return; }
  const due = fDue();
  const key = [g.id, g.version, f.id, L.fMin, due].join('|');
  if (key === D.cmpKey) return;
  D.cmpKey = key; D.cmpError = null;
  const gDue = Date.parse(g.due_at);
  const horizon = Math.max(gDue, due, addDays(due, 7)) + 864e5;
  const base = { asOf: isoLocal(Date.now()), availability: availability(horizon), events: calEvents().map((e) => ({ start: e.start, end: e.end, status: e.status, transparency: e.transparency })) };
  const goal = { id: 'goal', title: g.title, dueAt: g.due_at, remainingMinutes: g.minutes, minBlockMinutes: Math.min(60, g.minutes) };
  const promise = { id: 'promise', title: f.title.slice(0, 160), dueAt: isoLocal(due), remainingMinutes: L.fMin, minBlockMinutes: Math.min(60, L.fMin) };
  const half = Math.max(30, Math.round(g.minutes / 2 / 30) * 30);
  try {
    D.cmp = await api('/api/horizon/compare', { goalId: 'goal', variants: [
      { id: 'A', title: 'Protect your goal', consequence: 'Ask to move the new promise a week later.', input: { ...base, commitments: [goal, { ...promise, dueAt: isoLocal(addDays(due, 7)) }] } },
      { id: 'B', title: 'Keep every promise', consequence: 'Do both on their current dates.', input: { ...base, commitments: [goal, promise] } },
      { id: 'C', title: 'Shrink the goal', consequence: 'Keep the promise and do half the goal now.', input: { ...base, commitments: [{ ...goal, remainingMinutes: half }, promise] } },
    ] });
  } catch (e) { D.cmp = null; D.cmpError = e.message; }
  if (D.cmp && !L.picked) L.path = recommend();
  render();
}
const variant = (id) => D.cmp?.variants.find((v) => v.id === id);
const promiseIn = (v) => v?.plan.commitments.find((c) => c.id === 'promise');
function recommend() {
  const ok = (id) => variant(id)?.goal.status === 'fits' && promiseIn(variant(id))?.status === 'fits';
  if (ok('B')) return 'B';
  if (variant('A')?.goal.status === 'fits') return 'A';
  if (ok('C')) return 'C';
  return 'A';
}

/* ---------- live renderers ---------- */
function topBar() {
  const last = D.ledger?.lastRun ? new Date(D.ledger.lastRun) : null;
  const pill = S.mode === 'demo' ? 'Demo story · synthetic' : last ? `Bee synced ${last.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet';
  return `<div class="top"><div class="sync glass"><span class="band"></span><span class="live"></span>${esc(pill)}</div>
   <div class="modes glass"><button aria-pressed="${S.mode === 'demo'}" data-mode="demo">Demo</button><button aria-pressed="${S.mode === 'live'}" data-mode="live" ${D.synthetic ? 'title="Start with npm start to read your Bee"' : ''}>Your Bee</button></div>
   <button class="gear glass" data-settings aria-label="Settings">${GEAR}</button></div>`;
}
function ringLive() {
  const c = liveCounts(), tot = Object.values(c).reduce((a, b) => a + b, 0) || 1, R = 62, C = 2 * Math.PI * R, gap = 4; let off = 0;
  const segs = ['done', 'need', 'wait', 'later'].map((k) => { const len = Math.max(0, c[k] / tot * C - gap); const s = `<circle cx="75" cy="75" r="${R}" fill="none" stroke="${COL[k]}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len} ${C}" stroke-dashoffset="${-off}"/>`; off += c[k] / tot * C; return s; }).join('');
  return `<div class="ringcard glass"><div class="ring"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="${R}" fill="none" stroke="#ffffff70" stroke-width="14"/>${segs}</svg><div class="ctr"><div><b>${c.need}</b></div></div></div>
  <div class="legend">${['done', 'need', 'wait', 'later'].map((k) => `<button class="lg" data-lfilter="${k}" aria-pressed="${L.filter === k}"><i style="background:${COL[k]}"></i>${LIVE_LBL[k]}<b>${c[k]}</b></button>`).join('')}</div></div>`;
}
function feedLive() {
  const all = litems().filter((i) => catOf(i) === L.filter).sort(dueSort);
  const list = all.slice(0, 8);
  const head = { done: ['The hive did', 'Closed or merged', 'Done in Bee or merged by Ambeent. Tap any one for its receipt.'], need: ['Needs you', 'Still open in Bee', 'Your Bee to-dos, newest deadline first. Open one to fork your week around it.'], wait: ['Shared', 'Said as “we”', 'Joint intentions picked up from conversations. Ambeent will not act on these alone.'], later: ['Heard', 'Picked up from conversations', 'Phrases the extractor heard. Many are other people talking; check before trusting them.'] }[L.filter];
  return `<div class="blk w">${lbl(L.filter, head[0])}<h2>${head[1]}</h2><p class="sub">${head[2]}</p>
  ${list.map((i) => `<button class="item" data-lreceipt="${esc(i.id)}"><span class="sd" style="background:${COL[catOf(i)]}"></span><div style="min-width:0"><div class="t">${esc(i.title)}</div><div class="s"><span class="who ${whoOf(i)[0]}">${whoOf(i)[1]}</span>${esc(i.source)}</div>${catOf(i) === 'need' ? `<div class="via" style="color:#8a4300">${esc(reasonOf(i))}</div>` : ''}</div><span class="go2">Receipt ›</span></button>`).join('') || '<p class="muted">Nothing here.</p>'}
  ${all.length > list.length ? `<p class="more">and ${all.length - list.length} more in the ledger.</p>` : ''}</div>`;
}
function listenCard() {
  const h = D.heard, q = h ? String(h.quote || h.title) : '';
  return `<div class="blk o live">${lbl('ink', h && L.live ? 'Hearing something new' : 'Listening through Bee')}
   ${h ? `<div class="said"><span class="who ${whoOf(h)[0]}">${whoOf(h)[1]}</span><span class="typed">“${esc(q.slice(0, L.live || q.length))}${L.live ? '<b class="caret"></b>' : ''}”</span></div><p>${esc(h.source)}. Speaker attribution is not available on this account, so Ambeent labels by phrasing.</p>
     <div class="act"><button class="chip" data-focus="${esc(h.id)}">Fork my week around this</button></div>`
   : `<p>New conversations appear here as Bee records them. Keep <b>npm run stream</b> running, or sync now.</p>`}
   <div class="act">${D.busy === 'sync' ? '<span class="chip"><span class="spin"></span>Syncing from Bee</span>' : '<button class="chip" data-sync>Sync from Bee</button>'}</div>
   ${D.sync ? `<div class="${D.sync.ok ? 'okmsg' : 'err'}">${esc(D.sync.text)}</div>` : ''}</div>`;
}
function goalForm() {
  return `<div class="form"><p class="sub" style="color:#4b4825">What are you protecting? Ambeent compares every new promise against it.</p>
   <label>Goal</label><input class="fld" data-in="gTitle" value="${esc(L.gTitle)}" placeholder="Ship the first release">
   <label>Focused hours it still needs</label><div class="pick">${[2, 4, 6, 8, 12].map((h) => `<button data-ghours="${h}" aria-pressed="${L.gHours === h}">${h}h</button>`).join('')}</div>
   <label>Due</label><div class="pick">${[1, 2, 3, 4, 7].map((n) => `<button data-gdue="${n}" aria-pressed="${L.gDue === n}">${n === 7 ? 'In a week' : md(at(addDays(Date.now(), n), 17))}</button>`).join('')}</div>
   <button class="go" data-savegoal>Set this goal</button></div>`;
}
function conflictCard() {
  const f = focusItem(), g = goalOf();
  if (!f) return `<div class="blk y">${lbl('need', 'Needs you')}<h2>Nothing open to weigh.</h2><p class="sub">Sync from Bee to bring in your conversations.</p></div>`;
  const due = fDue();
  const free = g ? freeMinutes(Date.now(), Date.parse(g.due_at)) : null;
  return `<div class="blk y">${lbl('need', 'Needs you')}<h2>${esc(f.title)}</h2>
   ${f.quote && f.quote !== f.title ? `<p class="sub" style="color:#4b4825;margin:4px 0 0">“${esc(f.quote.slice(0, 220))}”</p>` : ''}
   <div class="s small muted" style="margin-top:6px"><span class="who ${whoOf(f)[0]}">${whoOf(f)[1]}</span> ${esc(f.source)}</div>
   <div class="form"><label>How long will it take?</label><div class="pick">${[30, 60, 120, 180, 240].map((m) => `<button data-fmin="${m}" aria-pressed="${L.fMin === m}">${hrs(m)}</button>`).join('')}</div>
   <label>Due</label><div class="pick">${[1, 2, 3, 5, 7].map((n) => { const v = at(addDays(Date.now(), n), 17); return `<button data-fdue="${v}" aria-pressed="${dayStart(due) === dayStart(v)}">${md(v)}</button>`; }).join('')}</div></div>
   ${g ? `<div class="stats"><div class="stat"><b>${hrs(g.minutes)}</b><span>${esc(g.title.slice(0, 40))} still needs</span></div><div class="stat"><b>${hrs(free)}</b><span>open before ${wd(Date.parse(g.due_at))}, 9 to 5 weekdays</span></div><div class="stat neg"><b>−${hrs(L.fMin)}</b><span>this promise takes</span></div></div>` : ''}</div>`;
}
function forkSvg(mobile) {
  const tag = (id) => { const v = variant(id); if (!v) return '…'; return v.goal.status === 'fits' && promiseIn(v)?.status === 'fits' ? 'Both fit' : v.goal.status === 'fits' ? 'Goal fits' : 'Goal at risk'; };
  const E = { A: [28, tag('A')], B: [78, tag('B')], C: [128, tag('C')] };
  const [vb, x0, x1, tx, fs] = mobile ? [330, 30, 170, 184, 17] : [520, 44, 300, 316, 19];
  return `<svg viewBox="0 0 ${vb} 156" style="width:100%;display:block;margin:0 0 12px" role="img" aria-label="Three paths from today">${Object.entries(E).map(([k, [y, t]]) => { const on = L.path === k; return `<g data-lpath="${k}" style="cursor:pointer"><path d="M${x0} 78C${x0 + 100} 78 ${x1 - 110} ${y} ${x1} ${y}" fill="none" stroke="${on ? '#6a3fe6' : '#ffffff'}" stroke-width="${on ? 5 : 3}" stroke-linecap="round" opacity="${on ? 1 : .75}"/><circle cx="${x1}" cy="${y}" r="${on ? 9 : 6}" fill="${on ? '#6a3fe6' : '#fff'}"/><text x="${tx}" y="${y + 4}" font-size="${fs}" font-family="Geist" font-weight="${on ? 700 : 500}" fill="#17160a">${k} · ${t}</text></g>`; }).join('')}<circle cx="${x0}" cy="78" r="12" fill="#17160a"/><text x="${x0}" y="122" font-size="${mobile ? 14 : 16}" font-family="Geist" font-weight="600" text-anchor="middle" fill="#17160a">Today</text></svg>`;
}
function weekGrid() {
  const v = variant(L.path);
  const days = []; for (let d = dayStart(Date.now()); days.length < 6; d = addDays(d, 1)) { const w = new Date(d).getDay(); if (w !== 0 && w !== 6) days.push(d); }
  const blocks = v ? v.plan.commitments.flatMap((c) => c.blocks.map((b) => ({ id: c.id, s: Date.parse(b.start), e: Date.parse(b.end) }))) : [];
  const g = goalOf(), due = fDue();
  return `<div class="week">${days.map((d) => {
    const end = addDays(d, 1);
    const evs = calEvents().filter((e) => Date.parse(e.start) < end && Date.parse(e.end) > d).map((e) => ['mtg', `Busy ${span(Date.parse(e.start), Date.parse(e.end))}`]);
    const bl = blocks.filter((b) => b.s >= d && b.s < end).map((b) => [b.id === 'goal' ? 'rel' : 'jor', `${b.id === 'goal' ? 'Goal' : 'Promise'} ${span(b.s, b.e)}`]);
    const dues = [];
    if (g && dayStart(Date.parse(g.due_at)) === d) dues.push(['due', 'Goal due']);
    const pd = L.path === 'A' ? addDays(due, 7) : due;
    if (dayStart(pd) === d) dues.push(['due', 'Promise due']);
    return `<div class="day"><b>${wd(d)} ${new Date(d).getDate()}</b>${ev([...bl, ...evs.slice(0, 3), ...dues])}</div>`;
  }).join('')}</div><div class="leg"><span><i style="background:var(--yel)"></i>Goal</span><span><i style="background:var(--lil)"></i>The promise</span><span><i style="background:#e5e1d4"></i>Your calendar</span><span>Weekdays 9 to 5 assumed</span></div>`;
}
function forkCard() {
  const g = goalOf();
  if (!g) return `<div class="ghost"><div class="blk l">${lbl('wait', 'Your choice')}<h2>Fork the week</h2><p class="sub">Set the goal you’re protecting and Ambeent will draw three paths.</p></div></div>`;
  if (D.cmpError) return `<div class="blk l">${lbl('wait', 'Your choice')}<h2>Fork the week</h2><div class="err">${esc(D.cmpError)}</div></div>`;
  if (!D.cmp) return `<div class="blk l">${lbl('wait', 'Your choice')}<h2>Fork the week</h2><p class="sub"><span class="spin"></span>Running the capacity engine on your calendar.</p></div>`;
  const opts = { A: ['Protect your goal', 'Ask to move this promise a week later.'], B: ['Keep every promise', 'Do both on their current dates.'], C: ['Shrink the goal', 'Keep the promise and do half the goal now.'] };
  return `<div class="blk l">${lbl('wait', 'Your choice')}<h2>Fork the week</h2><p class="sub">Three ways this week can go, placed on your real calendar.</p>
   <div class="fkd">${forkSvg(false)}</div><div class="fkm">${forkSvg(true)}</div>
   ${['A', 'B', 'C'].map((k) => { const v = variant(k), p = promiseIn(v); return `<button class="opt" aria-pressed="${L.path === k}" data-lpath="${k}"><span class="rad">${k}</span><div><b>${opts[k][0]}</b><span>${opts[k][1]}</span><em class="tag" style="font-style:normal">Goal ${v.goal.status === 'fits' ? 'fits' : `short ${hrs(v.goal.shortfallMinutes)}`} · promise ${p?.status === 'fits' ? 'fits' : `short ${hrs(p?.shortfallMinutes || 0)}`}</em></div></button>`; }).join('')}
   <div class="blk w" style="margin-top:14px;padding:16px"><div style="font-weight:600;margin-bottom:10px">Your week with ${L.path}</div>${weekGrid()}</div></div>`;
}
function hoursCard() {
  const v = variant(L.path), g = goalOf();
  if (!g) return `<div class="blk o">${lbl('ink', 'What are you protecting?')}<h2 style="color:#f4f0d8">Set a goal for this week.</h2><p>Ambeent weighs every new promise against it, using your real calendar.</p>${goalForm().replace('<p class="sub" style="color:#4b4825">What are you protecting? Ambeent compares every new promise against it.</p>', '')}</div>`;
  if (!v) return '';
  const need = v.goal.requiredMinutes, got = v.goal.scheduledBeforeDeadlineMinutes, n = Math.min(12, Math.ceil(need / 60));
  return `<div class="blk o">${lbl('ink', `${g.title.slice(0, 40)} · hours before ${wd(Date.parse(g.due_at))}`)}<div class="hrs">${Array.from({ length: n }, (_, i) => `<i class="${i < Math.floor(got / 60) ? 'rel' : ''}"></i>`).join('')}</div><div class="big">${hrs(got).replace('h', '')} of ${hrs(need).replace('h', '')}<small>hours</small></div><p>${v.goal.status === 'fits' ? 'The goal fits before its deadline on this path.' : `Short ${hrs(v.goal.shortfallMinutes)} before the deadline on this path.`} Calendar arithmetic, not a prediction.</p></div>`;
}
function modelsRow() {
  const m = D.models || {}, a = D.ask;
  const name = { jev: 'Jev', d1: 'System One' };
  if (!m.jev?.configured || !m.d1?.configured) return `<div class="models">${['jev', 'd1'].map((r) => `<span class="mdl">${name[r]} <b>${m[r]?.configured ? 'ready' : 'not connected'}</b></span>`).join('')}<button class="mdl split" data-settings>Add model keys</button></div>`;
  if (!a) return `<div class="models"><span class="mdl">Jev <b>ready</b></span><span class="mdl">System One <b>ready</b></span><button class="mdl agree" data-ask>Ask both about this promise</button></div>`;
  if (a.busy) return `<div class="models"><span class="mdl"><span class="spin"></span>Asking Jev and System One</span></div>`;
  if (a.error) return `<div class="err">${esc(a.error)}</div>`;
  const top = (d) => d ? Object.entries(d).sort((x, y) => y[1] - x[1])[0] : null;
  const tj = top(a.jev?.distribution || a.jev), td = top(a.d1?.distribution || a.d1);
  const agree = tj && td && tj[0] === td[0];
  return `<div class="models"><span class="mdl">Jev <b>${tj ? `${tj[0]} ${Math.round(tj[1] * 100)}%` : 'no answer'}</b></span><span class="mdl">System One <b>${td ? `${td[0]} ${Math.round(td[1] * 100)}%` : 'no answer'}</b></span><span class="mdl ${agree ? 'agree' : 'split'}">${agree ? 'Agree' : 'Split, so you decide'} · policy: ${esc(a.tier)}</span></div>`;
}
function messageFor() {
  const f = focusItem(), g = goalOf(), due = fDue();
  if (L.path === 'A') return [`About: ${f.title.slice(0, 80)}`, `Hi,\n\nI want to do this properly, but I'm protecting time for ${g.title} until ${md(Date.parse(g.due_at))}. Could I get "${f.title.slice(0, 120)}" to you by ${md(addDays(due, 7))} instead?\n\nThanks`];
  if (L.path === 'C') return [`About: ${f.title.slice(0, 80)}`, `Hi,\n\nConfirming I'll have "${f.title.slice(0, 120)}" to you by ${md(due)}.\n\nThanks`];
  return [`About: ${f.title.slice(0, 80)}`, `Hi,\n\nConfirming I'll have "${f.title.slice(0, 120)}" to you by ${md(due)}.\n\nThanks`];
}
function planBlocks() {
  const v = variant(L.path);
  if (!v) return [];
  return v.plan.commitments.flatMap((c) => c.blocks).filter((b) => Date.parse(b.start) > Date.now()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).slice(0, 8);
}
function actCard() {
  const v = variant(L.path), g = goalOf();
  if (!v || !g) return '';
  const rec = recommend(), conn = D.ws?.connectors || {};
  const google = conn.configured && conn.enabled;
  const exec = L.exec || (google ? 'google' : 'sandbox');
  const why = { A: ['Ask to move the promise, not drop it.', `Your goal needs ${hrs(g.minutes)} before ${md(Date.parse(g.due_at))}. Moving the new promise a week keeps that time intact.`], B: ['You have room for both.', 'Your calendar holds the goal and the promise on their current dates.'], C: ['Keep the promise, do half the goal now.', 'Only worth it if half the goal is still worth finishing on time. That’s your call.'] }[L.path];
  const b = D.bundle;
  let body = '';
  if (b) {
    const res = b.results || [];
    const sent = res.find((r) => r.step === 'message')?.receipt;
    const holds = res.filter((r) => r.step.startsWith('hold') && r.status === 'complete');
    body = `<div class="result"><div class="sec" style="margin-top:0">${b.state === 'complete' ? 'DONE BY THE HIVE' : esc(b.state.replace('_', ' ').toUpperCase())} · ${new Date(b.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</div>
     <div class="rt">${b.payload.executor === 'google' ? (sent?.kind === 'message_sent' ? 'Message sent and time held.' : 'Time held.') : 'Prepared in the sandbox.'}</div>
     <div class="kv"><span>Done by</span><div>${b.payload.executor === 'google' ? 'Gmail and Google Calendar · demo account' : 'Ambeent sandbox. Nothing left this device'}</div><span>Calendar</span><div>${holds.length} ${b.payload.executor === 'google' ? 'private holds' : 'local holds'}</div><span>Message</span><div>${sent ? (sent.kind === 'message_sent' ? `Sent to ${esc(b.payload.message.to)}. A request is not a yes.` : 'Prepared, not sent') : 'Not reached'}</div><span>Receipt</span><div class="small">${esc(b.id.slice(0, 8))} · hash ${esc(b.hash.slice(0, 10))}</div></div>
     <div class="act"><button class="chip" data-newplan>Plan another</button></div></div>`;
  } else if (L.run != null) {
    body = `<div class="run"><div class="lane">${[0, 1, 2, 3].map((i) => `<span style="animation-delay:${-i * .55}s">\\(◉)/ · ·</span>`).join('')}</div>${['Preparing the exact payload', 'Approving this version', exec === 'google' ? 'Holding time and sending' : 'Running in the sandbox'].map((s, i) => `<div class="step ${i < L.run ? 'ok' : i === L.run ? 'cur' : ''}"><span class="ck">${i < L.run ? '✓' : ''}</span>${s}</div>`).join('')}</div>`;
  } else if (L.sheet) {
    const [subj, msg] = messageFor();
    const blocks = planBlocks();
    body = `<div class="sheet form"><label>To</label><input class="fld" type="email" data-in="to" value="${esc(L.to)}" placeholder="name@example.com">
     <label>Subject</label><input class="fld" data-in="subject" value="${esc(L.subject ?? subj)}">
     <label>Message</label><textarea class="fld" data-in="body">${esc(L.body ?? msg)}</textarea>
     <label>Time held (${blocks.length})</label><div class="small">${blocks.map((x) => `${md(Date.parse(x.start))}, ${span(Date.parse(x.start), Date.parse(x.end))}`).join('<br>') || 'No future blocks on this path.'}</div>
     <label>Run with</label><div class="pick"><button data-exec="sandbox" aria-pressed="${exec === 'sandbox'}">Sandbox</button><button data-exec="google" aria-pressed="${exec === 'google'}" ${google ? '' : 'disabled title="Connect the demo Google account first"'}>Google demo account</button></div>
     ${D.msg ? `<div class="err">${esc(D.msg)}</div>` : ''}
     <button class="go" data-lgo ${blocks.length ? '' : 'disabled'}>Approve and run</button><p class="fine">${exec === 'google' ? 'Sends from your demo account and holds private time. The recipient still has to agree.' : 'The sandbox records holds and prepares the message. Nothing is sent.'}</p></div>`;
  } else body = `<div class="act"><button class="chip" data-lsheet>${I.mail}Review the message and holds</button></div>`;
  return `<div class="blk ${b ? 'w' : 'y'}">${b ? lbl('done', 'The hive did') : lbl('need', L.path === rec ? 'Recommended · calendar arithmetic' : `You picked ${L.path}`)}<h2>${why[0]}</h2><p style="margin:6px 0 0;font-size:15px;color:#3b3818">${why[1]}</p>${modelsRow()}${body}</div>`;
}
function horizonLive() {
  const t = D.ledger?.totals || {}, td = D.ledger?.today || {}, c = liveCounts();
  return `<section class="hero"><canvas data-swarm></canvas>${topBar()}
  <div class="row"><div class="txt"><h1>The hive is working<br>through your week.</h1>
  <p>Bee heard <span class="ii">${ico.cal}${t.conversations || 0} conversations</span>. The hive found <span class="ii">${ico.merge}${todoDupes().reduce((a, g) => a + g.count - 1, 0)} duplicate to-dos</span>, <span class="ii">${ico.check}${c.done} things already done</span>, and <span class="ii">${ico.fact}${c.need} to-dos are still open</span> in Bee.</p>${ringLive()}</div></div></section>
  <div class="wrap"><div class="col">${listenCard()}${conflictCard()}${forkCard()}</div>
  <div class="col sticky">${hoursCard()}${actCard()}</div><div class="span">${feedLive()}</div></div>`;
}

/* ---------- Compass, live ---------- */
function hiveLive() {
  const convs = D.ledger?.trust?.conversationList || [];
  const end = dayStart(Date.now()), start = addDays(end, -7 * 52);
  const weeks = Array(52).fill(0);
  for (const c of convs) { const t = Date.parse(c.at); if (t >= start && t <= end + 864e5) weeks[Math.min(51, Math.floor((t - start) / (7 * 864e5)))]++; }
  const max = Math.max(1, ...weeks), cols = 13, rows = 4, r = 17, w = r * Math.sqrt(3);
  let out = '';
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = weeks[x * rows + y], cx = w / 2 + x * w + (y % 2 ? w / 2 : 0) + 4, cy = r + y * r * 1.5 + 4;
    const pts = [0, 1, 2, 3, 4, 5].map((k) => { const a = Math.PI / 180 * (60 * k - 30); return `${(cx + (r - 1.5) * Math.cos(a)).toFixed(1)},${(cy + (r - 1.5) * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const tt = v / max, fill = v === 0 ? '#ffffff' : `rgba(${Math.round(250 - 40 * tt)},${Math.round(219 - 60 * tt)},${Math.round(74 + 150 * tt)},${.35 + tt * .65})`;
    out += `<polygon class="cellin" style="animation-delay:${(x * rows + y) * 18}ms;transform-origin:${cx}px ${cy}px" points="${pts}" fill="${fill}" stroke="#ffffffaa" stroke-width="1.5"><title>${v} conversations</title></polygon>`;
  }
  return { svg: `<svg class="hex" viewBox="0 0 ${cols * w + w / 2 + 8} ${rows * r * 1.5 + r + 8}" role="img" aria-label="Hive of weekly conversations">${out}</svg>`, active: weeks.filter(Boolean).length, total: weeks.reduce((a, b) => a + b, 0), start };
}
function waveOf(values, labelL, labelR, todayIndex) {
  const w = 300, h = 80, mx = Math.max(1, ...values), pts = values.map((y, i) => [i * w / Math.max(1, values.length - 1), h - 10 - (y / mx) * 60]);
  let d = `M${pts[0]}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
  const t = pts[Math.max(0, Math.min(pts.length - 1, todayIndex))];
  return `<svg class="wave" viewBox="-6 -24 312 120"><defs><linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fadb4a" stop-opacity=".55"/><stop offset="1" stop-color="#fadb4a" stop-opacity="0"/></linearGradient></defs><path d="${d} L300,${h} L0,${h}Z" fill="url(#wg2)"/><path d="${d}" fill="none" stroke="#fadb4a" stroke-width="2.2"/><circle cx="${t[0]}" cy="${t[1]}" r="5" fill="#1d1c0b" stroke="#fadb4a" stroke-width="2.5"/><text x="0" y="${h + 14}" font-size="10" fill="#cbc7a8" font-family="Geist">${esc(labelL)}</text><text x="300" y="${h + 14}" font-size="10" fill="#cbc7a8" font-family="Geist" text-anchor="end">${esc(labelR)}</text></svg>`;
}
function rangeLive() {
  const now = Date.now();
  if (S.range === 'week') { const m = freeMinutes(now, addDays(dayStart(now), 7)); return `<div class="blk o">${lbl('ink', 'Open time in the next 7 days')}<div class="big" style="margin-top:8px">${hrs(m).replace('h', '')}<small>hours</small></div><p>Weekday 9 to 5 minus your calendar (${calEvents().length} events loaded). Edit the window in a later version.</p></div>`; }
  if (S.range === 'month') {
    const endM = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime();
    const days = []; for (let d = dayStart(now); d < endM; d = addDays(d, 1)) days.push(freeMinutes(Math.max(d, now), addDays(d, 1)) / 60);
    const total = days.reduce((a, b) => a + b, 0);
    return `<div class="blk o">${lbl('ink', 'Open time left this month')}<div class="big" style="margin-top:8px">~${Math.round(total)}<small>hours</small></div>${days.length > 1 ? waveOf(days, 'Today', 'Month end', 0) : ''}<p>Assumes weekdays 9 to 5 are workable. That is an assumption, not a fact about you.</p></div>`;
  }
  const convs = D.ledger?.trust?.conversationList || [];
  const months = Array(12).fill(0), base = new Date(now); base.setDate(1); base.setHours(0, 0, 0, 0);
  for (const c of convs) { const d = new Date(c.at), diff = (base.getFullYear() - d.getFullYear()) * 12 + base.getMonth() - d.getMonth(); if (diff >= 0 && diff < 12) months[11 - diff]++; }
  return `<div class="blk o">${lbl('ink', 'Conversations per month')}<div class="big" style="margin-top:8px">${convs.length}<small>conversations in the record</small></div>${waveOf(months, '12 months ago', 'This month', 11)}<p>Seen, not predicted. Patterns stay observations until there is more to go on.</p></div>`;
}
function compassLive() {
  const goals = (D.ws?.grow || []).filter((g) => g.kind === 'goal' && g.state !== 'rejected');
  const sugg = (D.ws?.suggestions || []).filter((s) => !(L.hidden || []).includes(s.id))[0];
  const hv = hiveLive(), t = D.ledger?.totals || {};
  const doneTodos = litems().filter((i) => i.origin === 'bee_todo' && i.state === 'done').length;
  return `<section class="hero" style="min-height:220px"><canvas data-swarm></canvas>${topBar()}<h1>Where your time<br>is heading.</h1><p>Your goals in your words, against what your calendar can hold.</p>
  <div class="seg2 glass">${['week', 'month', 'year'].map((k) => `<button aria-pressed="${S.range === k}" data-range="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></section>
  <div class="wrap"><div class="col">
   <div class="blk y">${lbl('need', 'Needs you · one tap a day')}<h2>How did yesterday feel?</h2>
   <div class="faces">${FACES.map(([n, c, m], i) => `<button class="face" aria-pressed="${S.mood == i}" data-mood="${i}" aria-label="${n}" style="background:radial-gradient(circle at 35% 30%,${c.split(',')[0]},${c.split(',')[1]})"><svg viewBox="0 0 24 24"><path d="${m}"/></svg></button>`).join('')}</div>
   <p class="fine">${S.mood == null ? 'One tap. Kept on this device. Ambeent uses it to size tomorrow, never to grade you.' : 'Saved on this device.'}</p></div>
   <div class="blk l">${lbl('wait', 'Your choice')}<h2>Goals</h2><p class="sub" style="color:#4a3f78">Edit a title and press Enter. Goals with a due date and hours drive the fork.</p>
   ${goals.map((g) => `<div class="goal"><div style="flex:1;min-width:0"><input value="${esc(g.title)}" data-goaltitle="${esc(g.id)}" aria-label="Goal"><div style="color:var(--mut);font-size:13px">${g.due_at ? `Due ${md(Date.parse(g.due_at))}` : 'No date'}${g.minutes ? ` · ${hrs(g.minutes)} left` : ''}${g.evidence?.source ? ` · ${esc(g.evidence.source === 'user-stated' ? 'you said it' : 'noticed by Ambeent')}` : ''}</div></div><button class="chip" data-goaldone="${esc(g.id)}">Done</button></div>`).join('') || '<p class="muted">No goals yet.</p>'}
   ${sugg ? `<div class="sugg"><div class="lbl" style="margin-bottom:4px"><i style="background:var(--later)"></i>Ambeent noticed</div><b>${esc(sugg.title)}</b><div style="font-size:14px;color:var(--mut);margin-top:2px">${esc(sugg.detail)}</div><div class="act" style="margin-top:10px"><button class="chip on" data-suggadd="${esc(sugg.id)}">Make it a goal</button><button class="chip" data-sugghide="${esc(sugg.id)}">Not a goal</button></div></div>` : ''}
   ${L.newGoal ? `<div class="sugg">${goalForm()}</div>` : '<div class="act"><button class="chip" data-newgoal>' + I.plus + 'Add a goal</button></div>'}</div></div>
  <div class="col sticky">${rangeLive()}
   <div class="blk w">${lbl('later', 'Observed')}<h2>From your record</h2><p style="margin:6px 0 0;font-size:15px;color:#3b3818">Bee recorded ${t.beeTodos || 0} to-dos and marked ${doneTodos} done. ${t.facts || 0} facts are saved about you. Repetition alone does not establish what matters to you, so Ambeent asks instead of assuming.</p></div></div>
  <div class="span"><div class="blk w">${lbl('done', 'The hive')}<h2>The hive grows with every conversation.</h2><p class="sub">Each cell is a week of your Bee record. Fuller cells mean more conversations, and a firmer read on that week.</p>${hv.svg}
   <div class="leg" style="justify-content:space-between"><span>${new Date(hv.start).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span><span>${hv.total} conversations · ${hv.active} of 52 weeks with something to go on</span><span>Now</span></div></div></div></div>`;
}

/* ---------- Reconcile, live ---------- */
function todoDupes() {
  const byId = new Map(litems().map((i) => [i.id, i]));
  return (D.ledger?.today?.duplicates || []).filter((g) => g.ids.every((id) => byId.get(id)?.origin === 'bee_todo' && byId.get(id)?.state === 'live'));
}
function recLive() {
  const openTodos = litems().filter((i) => i.origin === 'bee_todo' && i.state === 'live').length;
  const totalTodos = litems().filter((i) => i.origin === 'bee_todo' && i.state !== 'done').length;
  const m = D.models || {};
  const split = litems().filter((i) => i.jevDist && i.d1Dist).filter((i) => { const t = (d) => Object.entries(d).sort((a, b) => b[1] - a[1])[0][0]; return t(i.jevDist) !== t(i.d1Dist); }).slice(0, 3);
  const groups = todoDupes().slice(0, 6);
  const ops = (D.rec?.operations || []).filter((o) => o.type === 'keep' && o.text);
  const reviews = D.rec?.reviews || {};
  const facts = ops.slice(0, L.factShow);
  const modelsCard = !m.jev?.configured || !m.d1?.configured
    ? `<div class="blk y span" style="border:2px solid var(--need)">${lbl('need', 'Needs you')}<h2>Connect the decision models.</h2><p class="sub" style="color:#4b4825">Jev and System One each judge whether a row should be ignored, remembered, asked about, drafted or acted on. When they disagree, it comes here. ${m.jev?.configured ? "Jev is connected." : "Jev is not connected."} ${m.d1?.configured ? "System One is connected." : "System One is not connected."} Both are needed.</p><div class="act"><button class="chip on" data-settings>Add model keys</button></div></div>`
    : split.length ? `<div class="blk y span" style="border:2px solid var(--need)">${lbl('need', 'Needs you')}<h2>The models disagree.</h2>${split.map((i) => { const t = (d) => Object.entries(d).sort((a, b) => b[1] - a[1])[0]; return `<div class="card" style="margin-bottom:8px">${esc(i.title)}<div class="models" style="margin-top:8px"><span class="mdl">Jev <b>${t(i.jevDist)[0]}</b></span><span class="mdl">System One <b>${t(i.d1Dist)[0]}</b></span><span class="mdl split">Split</span></div></div>`; }).join('')}</div>`
    : `<div class="blk y span">${lbl('need', 'Decision models')}<h2>No disagreements yet.</h2><p class="sub" style="color:#4b4825">${(D.ledger?.stats?.unscored || 0)} rows have not been scored by both models.</p><div class="act">${D.busy === 'score' ? '<span class="chip"><span class="spin"></span>Scoring</span>' : '<button class="chip on" data-score>Score the next 10</button>'}</div>${D.scoreMsg ? `<div class="${D.scoreMsg.ok ? 'okmsg' : 'err'}">${esc(D.scoreMsg.text)}</div>` : ''}</div>`;
  return `<section class="hero" style="min-height:220px"><canvas data-swarm></canvas>${topBar()}<h1>Keep what<br>holds up.</h1><p>The hive checks Bee’s to-dos and facts against what actually happened. You only see what it can’t settle.</p>
  <div class="count">${openTodos < totalTodos ? `<s>${totalTodos}</s>` : ''}${openTodos}<span style="font:600 14px Geist;margin-left:10px;color:#4b4825">open Bee to-dos</span></div></section>
  <div class="wrap">${modelsCard}
   <div class="blk l">${lbl('wait', 'Proposed · duplicates')}<h2>Likely the same task</h2><p class="sub" style="color:#4a3f78">Same wording, recorded more than once. Merging keeps the copy with a due date. You can undo it.</p>
   ${L.undo.map((u, k) => `<div class="card" style="margin-bottom:10px;display:flex;align-items:center;gap:10px"><span class="dot"></span><div style="flex:1">Merged ${u.ids.length} copies: <b>${esc(u.text)}</b></div><button class="chip" data-unmerge="${k}">Undo</button></div>`).join('')}
   ${groups.map((g, k) => `<div class="card" style="margin-bottom:10px">${esc(g.text)}<small>${g.count} copies · open ${g.openDays} days</small><div class="act" style="margin-top:8px"><button class="chip on" data-lmerge="${k}">Merge into one</button></div></div>`).join('') || '<p class="muted">No duplicates left.</p>'}</div>
   <div class="blk w">${lbl('wait', 'Proposed · facts')}<h2>Facts to confirm</h2><p class="sub">${ops.length} facts Bee saved without confirmation. The hive found no independent evidence for these yet, so they wait for you. Your answer stays in Ambeent; Bee is not changed.</p>
   ${D.rec?.error ? `<div class="err">${esc(D.rec.error)}</div>` : !D.rec ? '<p class="sub"><span class="spin"></span>Checking facts</p>' : ''}
   ${facts.map((o) => { const v = reviews[o.targetId]; return `<div class="card" style="background:#f6f3ea;margin-bottom:8px">${v ? `<span class="dot" style="display:inline-block;margin-right:8px"></span><b>${v === 'confirmed' ? 'Confirmed' : 'Not true'}:</b> ` : ''}${esc(o.text)}<small>${esc(o.reason || '')}</small><div class="act" style="margin-top:8px">${v ? `<button class="chip" data-fact2="${esc(o.targetId)}" data-v="undo">Undo</button>` : `<button class="chip on" data-fact2="${esc(o.targetId)}" data-v="confirmed">Confirm</button><button class="chip" data-fact2="${esc(o.targetId)}" data-v="not_true">Not true</button>`}</div></div>`; }).join('')}
   ${ops.length > facts.length ? '<div class="act"><button class="chip" data-morefacts>Show more</button></div>' : ''}</div>
   <div class="span note"><b style="color:var(--ink)">Who said it decides what the hive may do.</b> Bee reports the speaker as Unknown on this account, so Ambeent labels by phrasing (“I’ll”, “we should”) and asks before acting on anything.</div></div>`;
}
function receiptLive() {
  const i = litems().find((x) => x.id === S.receipt);
  if (!i) return '';
  const top = (d) => d ? Object.entries(d).sort((a, b) => b[1] - a[1])[0] : null;
  const tj = top(i.jevDist), td = top(i.d1Dist);
  const slip = (D.ledger.today.likelyToSlip || []).find((s) => s.id === i.id);
  return `<div class="scrim" data-close><div class="rc" role="dialog" aria-label="Receipt"><button class="x" data-close aria-label="Close">✕</button>
   <span class="who ${whoOf(i)[0]}">${whoOf(i)[1]}</span><h3>${esc(i.title)}</h3>
   ${i.quote ? `<div class="quote">“${esc(i.quote.slice(0, 400))}”</div>` : ''}
   <div class="kv"><span>Source</span><div>${esc(i.source)}</div><span>Rule</span><div>${esc(i.rule || '—')}</div><span>State</span><div>${esc(i.state)}${i.closedBy ? ` · closed by ${esc(i.closedBy.source || '')}` : ''}</div>${i.dueAt ? `<span>Due</span><div>${md(Date.parse(i.dueAt))}</div>` : ''}${slip ? `<span>Why first</span><div>${esc(slip.reason)}</div>` : ''}<span>Policy</span><div>${esc(i.tier || i.decision)}${i.why ? ` · ${esc(i.why)}` : ''}</div></div>
   <div class="sec">DECISION MODELS</div><div class="models" style="margin-top:0">${tj ? `<span class="mdl" style="background:#f1eee4">Jev <b>${tj[0]} ${Math.round(tj[1] * 100)}%</b></span><span class="mdl" style="background:#f1eee4">System One <b>${td ? td[0] : '—'}</b></span>` : '<span class="mdl" style="background:#f1eee4">Not scored yet</span><button class="mdl split" data-settings>Connect models</button>'}</div>
   ${i.state === 'live' ? `<div class="act"><button class="chip on" data-focus="${esc(i.id)}">Fork my week around this</button></div>` : ''}</div></div>`;
}
function settings() {
  const m = D.models || {}, conn = D.ws?.connectors || {};
  const role = (r, name, hint) => `<div class="card" style="background:#f6f3ea;margin-bottom:10px"><b>${name}</b> <span class="small muted">${hint}</span>
   <div class="small" style="margin-top:4px">${m[r]?.configured ? `<span class="dot" style="display:inline-block;margin-right:6px"></span>Configured: ${esc(m[r].model)}. Use Test connection to check it answers.` : `Not connected${m[r]?.missing?.length ? ` · missing ${esc(m[r].missing.join(', '))}` : ''}`}</div>
   <div class="form"><label>Base URL (OpenAI-compatible)</label><input class="fld" data-mf="${r}-baseUrl" value="${esc(m[r]?.baseUrl || '')}" placeholder="https://api.example.com/v1">
   <label>Model</label><input class="fld" data-mf="${r}-model" value="${esc(m[r]?.model || '')}" placeholder="model-name">
   <label>API key</label><input class="fld" type="password" data-mf="${r}-apiKey" placeholder="${m[r]?.hasKey ? 'Saved. Leave blank to keep it.' : 'Paste the key'}" autocomplete="off"></div>
   <div class="act"><button class="chip on" data-savemodel="${r}">Save</button><button class="chip" data-testmodel="${r}">Test connection</button></div>
   ${D.saveMsg[r] ? `<div class="${D.saveMsg[r].ok ? 'okmsg' : 'err'}">${esc(D.saveMsg[r].text)}</div>` : ''}
   ${D.test[r] ? `<div class="${D.test[r].ok ? 'okmsg' : 'err'}">${D.test[r].busy ? '<span class="spin"></span>Testing' : esc(D.test[r].ok ? `Answered in ${D.test[r].latencyMs ?? '?'} ms: ${D.test[r].reply}` : D.test[r].message)}</div>` : ''}</div>`;
  return `<div class="scrim" data-close><div class="rc" role="dialog" aria-label="Settings"><button class="x" data-close aria-label="Close">✕</button><h3>Settings</h3>
   <div class="sec">MODE</div><p class="small">${D.synthetic ? 'This server is running the synthetic demo (npm run demo). Start it with npm start to read your Bee.' : 'Demo shows the scripted story. Your Bee reads the local ledger on this machine.'}</p>
   <div class="sec">DECISION MODELS</div><p class="small muted">Keys are written to the git-ignored .env on this machine and never sent back to the browser.</p>
   ${role('jev', 'Jev', 'expected-utility judge')}${role('d1', 'System One', 'fast first read (d1)')}
   <div class="sec">BEE</div><p class="small">${D.ledger ? `${D.ledger.totals?.conversations || 0} conversations · last sync ${D.ledger.lastRun ? new Date(D.ledger.lastRun).toLocaleString() : 'never'}` : 'No ledger loaded.'}</p>
   <div class="sec">ACTIONS</div><p class="small">${conn.configured && conn.enabled ? `Google demo account connected: ${esc(conn.account)}.` : 'Google demo account not connected. Actions run in the sandbox. To connect: gog auth add &lt;demo-email&gt; --services gmail,calendar --gmail-scope send, then set LATENT_DEMO_ACCOUNT, LATENT_DEMO_CALENDAR and LATENT_EXTERNAL_ACTIONS=1 in .env and restart.'}</p></div></div>`;
}

/* ---------- live actions ---------- */
async function runPlan() {
  const [subj, msg] = messageFor();
  const conn = D.ws?.connectors || {};
  const exec = L.exec || (conn.configured && conn.enabled ? 'google' : 'sandbox');
  const payload = { executor: exec, goal: goalOf().title.slice(0, 170), blocks: planBlocks().map((b) => ({ start: b.start, end: b.end })), message: { to: L.to.trim(), subject: (L.subject ?? subj).trim(), body: L.body ?? msg } };
  D.msg = null; L.run = 0; SPEED = 4; render();
  try {
    const prepared = await api('/api/actions', payload); L.run = 1; renderQuiet();
    const approved = await api(`/api/actions/${prepared.id}/approve`, { hash: prepared.hash }); L.run = 2; renderQuiet();
    D.bundle = await api(`/api/actions/${approved.id}/execute`, {});
    toast(D.bundle.state === 'complete' ? 'Done by the hive' : 'Needs reconciliation');
  } catch (e) { D.msg = e.message; L.sheet = true; }
  L.run = null; SPEED = 1; render();
}
async function liveClick(d) {
  if (d.lfilter) { L.filter = d.lfilter; return true; }
  if (d.lreceipt) { S.receipt = d.lreceipt; return true; }
  if (d.focus) { L.picked = false; L.focus = d.focus; L.fDue = null; D.cmpKey = null; D.ask = null; D.bundle = null; S.receipt = null; S.tab = 'horizon'; compute(); return true; }
  if (d.fmin) { L.fMin = +d.fmin; compute(); return true; }
  if (d.fdue) { L.fDue = +d.fdue; compute(); return true; }
  if (d.ghours) { L.gHours = +d.ghours; return true; }
  if (d.gdue) { L.gDue = +d.gdue; return true; }
  if (d.lpath) { if (L.run != null) return false; L.path = d.lpath; L.picked = true; L.sheet = false; D.bundle = null; return true; }
  if ('lsheet' in d) { L.sheet = !L.sheet; return true; }
  if (d.exec) { L.exec = d.exec; return true; }
  if ('lgo' in d) { runPlan(); return false; }
  if ('newplan' in d) { D.bundle = null; L.sheet = false; return true; }
  if ('newgoal' in d) { L.newGoal = true; return true; }
  if ('savegoal' in d) {
    if (!L.gTitle.trim()) { toast('Name the goal first'); return false; }
    try { await api('/api/grow', { kind: 'goal', title: L.gTitle.trim(), detail: '', due_at: isoLocal(at(addDays(Date.now(), L.gDue), 17)), minutes: L.gHours * 60 }); D.ws = await api('/api/workspace'); L.newGoal = false; D.cmpKey = null; compute(); toast('Goal saved'); } catch (e) { toast(e.message); }
    return true;
  }
  if (d.goaldone) { const g = D.ws.grow.find((x) => x.id === d.goaldone); try { await api('/api/grow', { id: g.id, version: g.version, kind: g.kind, title: g.title, detail: g.detail, state: 'paused', due_at: g.due_at, minutes: g.minutes }); D.ws = await api('/api/workspace'); D.cmpKey = null; compute(); } catch (e) { toast(e.message); } return true; }
  if (d.suggadd) { const sg = D.ws.suggestions.find((x) => x.id === d.suggadd); try { await api('/api/grow', { kind: 'goal', title: sg.title.replace(/^Repeated topic: /, '').replace(/^./, (c) => c.toUpperCase()), detail: sg.detail, suggestionId: sg.id }); D.ws = await api('/api/workspace'); toast('Added as a goal'); } catch (e) { toast(e.message); } return true; }
  if (d.sugghide) { L.hidden = (L.hidden || []).concat(d.sugghide); return true; }
  if (d.lmerge !== undefined) {
    const g = todoDupes()[+d.lmerge];
    try { const r = await api('/api/merge', { ids: g.ids }); L.undo.unshift({ text: g.text, ids: g.ids, kept: r.kept }); D.ledger = r.ledger; toast(`Merged ${r.merged + 1} copies`); } catch (e) { toast(e.message); }
    return true;
  }
  if (d.unmerge !== undefined && S.mode === 'live') {
    const u = L.undo[+d.unmerge];
    try { const r = await api('/api/commitments/restore', { entries: u.ids.filter((id) => id !== u.kept).map((id) => ({ id, priorState: 'live' })) }); D.ledger = r.ledger; L.undo.splice(+d.unmerge, 1); toast('Restored'); } catch (e) { toast(e.message); }
    return true;
  }
  if (d.fact2) { try { await api(`/api/facts/${encodeURIComponent(d.fact2)}`, { verdict: d.v }); D.rec.reviews = { ...D.rec.reviews }; if (d.v === 'undo') delete D.rec.reviews[d.fact2]; else D.rec.reviews[d.fact2] = d.v; } catch (e) { toast(e.message); } return true; }
  if ('morefacts' in d) { L.factShow += 6; return true; }
  if ('sync' in d) {
    D.busy = 'sync'; D.sync = null; render();
    try { const before = new Set(litems().map((i) => i.id)); const r = await api('/api/sync', {}); D.ledger = r.ledger; const fresh = litems().filter((i) => !before.has(i.id) && i.origin === 'conversation'); D.known = new Set(litems().map((i) => i.id)); D.sync = { ok: true, text: fresh.length ? `${fresh.length} new rows from Bee.` : 'Up to date. Nothing new from Bee.' }; if (fresh.length) hear(fresh[0]); }
    catch (e) { D.sync = { ok: false, text: `${e.message} Check that the bee CLI is installed and signed in.` }; }
    D.busy = null; return true;
  }
  if ('score' in d) {
    D.busy = 'score'; D.scoreMsg = null; render();
    try { const r = await api('/api/decide/run', { limit: 10 }); if (r.ledger) D.ledger = r.ledger; D.scoreMsg = r.ok ? { ok: true, text: `Scored ${r.decided} rows.` } : { ok: false, text: `Not run: ${(r.missingByRole || []).map((x) => `${x.role} missing ${x.missing.join(', ')}`).join('; ') || r.reason}` }; } catch (e) { D.scoreMsg = { ok: false, text: e.message }; }
    D.busy = null; return true;
  }
  if ('ask' in d) {
    D.ask = { busy: true }; render();
    try { const r = await api('/api/decide/item', { id: focusItem().id }); D.ask = r.configured === false ? { error: 'Both models need to be connected.' } : r.error ? { error: r.error } : r; } catch (e) { D.ask = { error: e.message }; }
    return true;
  }
  return false;
}
async function settingsClick(d) {
  if (d.savemodel) {
    const r = d.savemodel, get = (f) => document.querySelector(`[data-mf="${r}-${f}"]`)?.value || '';
    try { D.models = await api('/api/models', { role: r, baseUrl: get('baseUrl'), model: get('model'), apiKey: get('apiKey') }); D.saveMsg[r] = { ok: true, text: 'Saved to .env on this machine.' }; } catch (e) { D.saveMsg[r] = { ok: false, text: e.message }; }
    return true;
  }
  if (d.testmodel) {
    const r = d.testmodel; D.test[r] = { busy: true, ok: true }; render();
    try { D.test[r] = await api('/api/models/test', { role: r }); } catch (e) { D.test[r] = { ok: false, message: e.message }; }
    return true;
  }
  return false;
}

/* ---------- shell ---------- */
const labels = [['horizon', 'Horizon'], ['compass', 'Compass'], ['rec', 'Reconcile']];
function page() {
  if (!D.ready) return `<section class="hero"><h1>Ambeent</h1><p><span class="spin"></span>Opening your hive.</p></section>`;
  if (D.error && S.mode === 'live') return `<section class="hero">${topBar()}<h1>Ambeent</h1><div class="err">${esc(D.error)}</div></section>`;
  if (S.mode === 'live') return S.tab === 'horizon' ? horizonLive() : S.tab === 'compass' ? compassLive() : recLive();
  return S.tab === 'horizon' ? horizonDemo() : S.tab === 'compass' ? compassDemo() : recDemo();
}
function initials() {
  const n = S.mode === 'live' ? (D.ledger?.owner || '') : 'Max';
  return n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'ME';
}
function render() {
  document.querySelectorAll('[data-root]').forEach((r) => {
    const st = r.querySelector('.main')?.scrollTop || 0;
    const oldCanvas = r.querySelector('canvas[data-swarm]');
    const sheetSt = r.querySelector('.rc')?.scrollTop || 0;
    const name = S.mode === 'live' ? (D.ledger?.owner || 'You').split(/\s+/)[0] : 'Max';
    r.innerHTML = `<aside class="side"><div class="brand">${WORDMARK}</div>${labels.map(([k, l]) => `<button class="nav" ${S.tab == k ? 'aria-current="page"' : ''} data-tab="${k}">${I[k]}${l}</button>`).join('')}<div class="me"><span class="av">${esc(initials())}</span>${esc(name)}</div></aside>
    <main class="main">${page()}</main>
    <nav class="tabbar glass">${labels.map(([k, l]) => `<button class="tb" ${S.tab == k ? 'aria-current="page"' : ''} data-tab="${k}">${I[k]}${l}</button>`).join('')}</nav>
    ${S.settings ? settings() : S.receipt ? (S.mode === 'live' ? receiptLive() : receiptDemo()) : ''}<div class="toast glass dark ${S.toast ? '' : 'hide'}">${esc(S.toast || '')}</div>`;
    r.querySelector('.main').scrollTop = st;
    // Keep the live bee canvas across re-renders: a fresh canvas is blank until the next frame.
    const fresh = r.querySelector('canvas[data-swarm]');
    if (oldCanvas && fresh && oldCanvas.dataset.tab === S.tab) fresh.replaceWith(oldCanvas);
    else if (fresh) fresh.dataset.tab = S.tab;
    const rc = r.querySelector('.rc'); if (rc) rc.scrollTop = sheetSt;
  });
  if (S.mode === 'live' && S.tab === 'horizon' && D.ledger && goalOf() && focusItem()) compute();
}
/* Typing updates the quote in place, so the page (and the bees) never rebuild mid-sentence. */
function typeTo(text, n) {
  document.querySelectorAll('.typed').forEach((el) => { el.innerHTML = `“${esc(text.slice(0, n))}${n < text.length ? '<b class="caret"></b>' : ''}”`; });
}
/* Timer-driven renders skip entrance animations so cards don't replay them. */
function renderQuiet() { document.documentElement.classList.add('quiet'); render(); requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('quiet'))); }
function toast(t) { S.toast = t; renderQuiet(); setTimeout(() => { S.toast = null; renderQuiet(); }, 2400); }
function busyTyping() { const a = document.activeElement; return a && /INPUT|TEXTAREA/.test(a.tagName); }

document.addEventListener('input', (e) => {
  const k = e.target.dataset?.in;
  if (k) L[k] = e.target.value;
});
document.addEventListener('change', async (e) => {
  const id = e.target.dataset?.goaltitle;
  if (!id) return;
  const g = D.ws.grow.find((x) => x.id === id);
  try { await api('/api/grow', { id: g.id, version: g.version, kind: g.kind, title: e.target.value, detail: g.detail, state: g.state, due_at: g.due_at, minutes: g.minutes }); D.ws = await api('/api/workspace'); D.cmpKey = null; toast('Goal renamed'); } catch (err) { toast(err.message); }
});
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button,[data-path],[data-lpath],[data-close]');
  if (!t || t.disabled) return;
  const d = t.dataset;
  if ('close' in d) { if (e.target.closest('.rc') && !e.target.closest('button')) return; S.receipt = null; S.settings = false; return render(); }
  if (d.mode) {
    if (d.mode === 'live' && D.synthetic) { toast('Start the app with npm start to read your Bee'); return; }
    S.mode = d.mode; S.receipt = null; localStorage.setItem('latent-mode', d.mode);
    if (S.mode === 'live' && !D.ledger) { try { await loadLedger(); D.known = new Set(litems().map((i) => i.id)); } catch (err) { D.error = err.message; } }
    return render();
  }
  if ('settings' in d) { S.settings = true; S.receipt = null; try { D.models = await api('/api/models'); } catch {} return render(); }
  if (d.tab) { S.tab = d.tab; S.sheet = false; return render(); }
  if (d.range) { S.range = d.range; return render(); }
  if (d.mood !== undefined) { S.mood = +d.mood; localStorage.setItem('latent-mood', `${new Date().toDateString()}|${d.mood}`); return render(); }
  if (S.settings) { if (await settingsClick(d)) render(); return; }
  if (S.mode === 'live') { if (await liveClick(d)) render(); return; }
  demoClick(d);
});
let SPEED=1;
function replay(){S.listen=1;SPEED=3;render();const q='Sure, I’ll help with the deck by Thursday.';const t=setInterval(()=>{S.listen+=2;typeTo(q,S.listen);if(S.listen>=q.length){clearInterval(t);setTimeout(()=>{S.heard=true;S.listen=0;SPEED=1;render()},1600)}},60)}
function go(){const n=P[S.path].steps.length;S.run=0;S.sheet=false;SPEED=4;render();
 const tick=()=>{S.run++;if(S.run>=n){setTimeout(()=>{S.run=null;S.sent=true;SPEED=1;S.filter='done';renderQuiet();toast('Done by the hive')},650);renderQuiet();return}renderQuiet();setTimeout(tick,750)};setTimeout(tick,900)}
function demoClick(d){
 
 if(d.path){if(S.run!=null)return;S.path=d.path;S.sheet=false;S.sent=false}
 else if('replay'in d){replay();return}else if('sheet'in d)S.sheet=!S.sheet;else if('go'in d){go();return}else if('undoRun'in d){S.sent=false}
 else if(d.filter)S.filter=d.filter;else if(d.receipt){if(d.receipt=='fork'){S.receipt=null;S.filter='need'}S.receipt=d.receipt}
 else if(d.sugg){if(d.sugg=='add')S.goals=S.goals.concat([['Play guitar','Sundays · noticed by Ambeent',100,'#bfeccb']]);S.sugg=false}else if(d.range)S.range=d.range;else if(d.mood!==undefined)S.mood=+d.mood;else if(d.tag2){S.tags[d.tag2]=!S.tags[d.tag2]}else if(d.split){S.split=d.split}else if(d.merge!==undefined)S.merged[d.merge]=1;else if(d.unmerge!==undefined)delete S.merged[d.unmerge];
 else if(d.fact!==undefined)S.facts[d.fact]=d.v;else return;render()}
/* ASCII bees: ten per header, faint, spread out */
const bees=[[.06,.18],[.30,.10],[.55,.16],[.80,.08],[.94,.30],[.70,.42],[.42,.50],[.16,.62],[.60,.80],[.88,.70]].map(([x,y],i)=>({x,y,s:.6+.1*(i%4),p:i*1.9}));
let T=0,last=0;
function swarm(dt){T+=dt*SPEED;
 document.querySelectorAll('canvas[data-swarm]').forEach(c=>{
  const r=c.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(devicePixelRatio||1,2),w=r.width,h=r.height;
  if(c.width!=Math.round(w*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
  const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='center';
  g.font='600 13px ui-monospace,Menlo,monospace';g.fillStyle='#4b3f0f12';for(let y=0,row=0;y<h;y+=17,row++)for(let x=(row%2)*10;x<w;x+=20)g.fillText('·',x,y);
  bees.forEach((b,i)=>{const X=a=>w*b.x+Math.sin(a)*w*.025,Y=a=>h*b.y+Math.cos(a*1.3)*h*.05,a=T/900*b.s+b.p;
   for(let k=1;k<=4;k++){g.fillStyle=`rgba(75,63,15,${.14-k*.028})`;g.fillText('·',X(a-k*.18),Y(a-k*.18))}
   g.fillStyle=SPEED>1?'#2a240660':'#2a240630';g.font='500 12px ui-monospace,Menlo,monospace';g.fillText(Math.floor(T/110+i)%2?'\\(◉)/':'/(◉)\\',X(a),Y(a))})});
}
(function loop(t){if(t-last>80){swarm(last?t-last:0);last=t}requestAnimationFrame(loop)})(0);
boot();
