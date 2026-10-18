// preview-data.mjs — a synthetic ledger used only for interface work.
//
// This is NOT device data and it is not presented as any. The server serves it
// only when PREVIEW=1, the ledger it returns sets `preview: true`, and every
// screen renders a standing "Synthetic data" badge while that flag is set. The
// real path in ledger.mjs is untouched and never imports this file.
//
// It exists for one reason: the real ledger is 536 rows of unpunctuated meeting
// transcript, which is honest but useless for judging an interface. This dataset
// is shaped like a person's week — a few names, four source kinds, a spread of
// outcomes — so the design can be pushed without real text wearing every layout
// down to the same grey.
//
// The shape matches buildLedger() exactly, so the client renders both without a
// single branch. Any field the real path cannot compute (per-item risk, factors
// with sample sizes, hour-of-day bars, the calibration curve) is present here and
// marked so the interface can be designed against it.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const now = () => Date.now();
const daysAgo = (days, hour = 9) => {
  const date = new Date(now() - days * DAY);
  date.setHours(hour, 14, 0, 0);
  return date.toISOString();
};
const hoursAgo = (hours) => new Date(now() - hours * HOUR).toISOString();

/** A five-way distribution whose mass sits mostly on one option. */
function dist(top, probability) {
  const others = ['ignore', 'remember', 'ask', 'draft', 'execute'].filter((option) => option !== top);
  const spread = (1 - probability) / others.length;
  const out = { ignore: spread, remember: spread, ask: spread, draft: spread, execute: spread };
  out[top] = probability;
  return out;
}

const TIER_LABEL = {
  execute: 'Acted',
  draft: 'Draft',
  ask: 'Needs you',
  remember: 'Remembered',
  ignore: 'Leave it',
};

const POLICY = {
  draft: 'Latent can prepare a draft. Nothing is sent or shared without your approval.',
  ask: 'Held back. The commitment is unclear or shared, so it needs your decision before any action.',
  remember: 'Remembered without interrupting. Surfaced again when it is relevant.',
  execute: 'Closed. No external action is pending for this item.',
  ignore: 'Retired. No task and no action follow from it.',
  unscored: 'No decision yet.',
};

const WHY = {
  'first-person-promise': 'A first-person promise in your own words.',
  'shared-intent': 'Shared phrasing ("we should", "let\u2019s"). Not a firm commitment on its own.',
  'stated-interest': 'A stated interest rather than a commitment.',
  'bee-todo': 'You wrote this as a Bee todo.',
};

const SOURCE_KIND_LABEL = { call: 'a call', class: 'a lecture', email: 'an email', todo: 'a todo' };

let seq = 0;

/**
 * One commitment. `f` is the factor list behind the tier: [label, rate|null, n].
 * A null rate or an n under ten is rendered as "Not enough data", never as a
 * number, which is the rule the whole design hangs off.
 */
function mk(spec) {
  seq += 1;
  const tier = spec.tier || 'ask';
  const confidence = spec.p || 0.7;
  const sourceKind = spec.kind || 'call';
  const state = spec.state || 'live';
  const closedBy =
    state === 'live'
      ? null
      : {
          at: daysAgo(spec.age - 1, 16),
          source: spec.closedBy || (sourceKind === 'todo' ? 'bee.todo' : 'user'),
        };

  return {
    id: `pv${String(seq).padStart(3, '0')}`,
    title: spec.t,
    quote: spec.q || `\u201c${spec.t}.\u201d`,
    owner: 'Max',
    person: spec.who || null,
    source:
      sourceKind === 'todo'
        ? `Bee todo \u00b7 ${new Date(daysAgo(spec.age)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : `Bee ${SOURCE_KIND_LABEL[sourceKind]} \u00b7 ${new Date(daysAgo(spec.age)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    sourceId: sourceKind === 'todo' ? null : `conv-${seq}`,
    origin: sourceKind === 'todo' ? 'bee_todo' : 'conversation',
    sourceKind,
    decision: state === 'done' ? 'execute' : state === 'obsolete' || state === 'forgotten' ? 'ignore' : tier,
    tier,
    state,
    scored: true,
    confidence,
    jev: { decision: tier, score: spec.jp ?? Math.min(0.99, confidence + 0.04) },
    d1: { decision: tier, score: spec.dp ?? Math.max(0.35, confidence - 0.03) },
    stakes: spec.stakes ?? 2,
    jevDist: dist(tier, spec.jp ?? Math.min(0.99, confidence + 0.04)),
    d1Dist: dist(tier, spec.dp ?? Math.max(0.35, confidence - 0.03)),
    why: spec.why || WHY[spec.rule || 'first-person-promise'],
    policy: POLICY[state === 'live' ? tier : state === 'done' ? 'execute' : 'ignore'],
    result:
      state === 'done'
        ? `${spec.ev || 'Closed.'}`
        : state === 'obsolete'
          ? 'Retired. No action was taken.'
          : state === 'forgotten'
            ? 'Forgotten. No action was taken.'
            : 'No action taken yet.',
    age: spec.age,
    createdAt: daysAgo(spec.age, spec.hour ?? 14),
    dueAt: spec.due ? daysAgo(-spec.due, 12) : null,
    dueDay: spec.due ? daysAgo(-spec.due, 12).slice(0, 10) : null,
    spanStart: spec.kind === 'todo' ? null : 12,
    spanEnd: spec.kind === 'todo' ? null : 12 + (spec.q || spec.t).length,
    redaction: spec.kind === 'class' ? 'assumed-single-speaker' : 'profile-name-match',
    speaker: 'Max',
    rule: spec.rule || 'first-person-promise',
    closedBy,
    /* --- fields only the preview path can supply ------------------------- */
    risk: spec.risk ?? null,
    reason: spec.chip || null,
    factors: spec.f || null,
    evidence: spec.ev || null,
    scheduled: Boolean(spec.scheduled),
    preview: true,
  };
}

function items() {
  seq = 0;
  return [
    // --- this week, still open -------------------------------------------
    mk({
      t: 'Email Dr. Rao about the extension',
      q: '\u201cI should email Dr. Rao about the extension.\u201d',
      who: 'Dr. Rao', kind: 'call', risk: 0.74, chip: 'Vague time', stakes: 3, age: 1, tier: 'draft', p: 0.71,
      f: [['\u201cI should\u201d promises', 0.38, 52], ['To professors', 0.81, 27], ['New contacts', null, 6]],
    }),
    mk({
      t: 'Write section 3',
      q: '\u201cI\u2019ll take section 3 by Friday.\u201d',
      who: 'Group', kind: 'call', risk: 0.61, chip: 'Fourth promise this week', stakes: 3, age: 5, tier: 'ask', p: 0.6, due: 2,
      f: [['Promises this week', 0.52, 28], ['Group-project promises', 0.52, 19], ['Specific deadline', 0.71, 44]],
    }),
    mk({
      t: 'Return Jake\u2019s charger',
      q: '\u201cI\u2019ll bring your charger back.\u201d',
      who: 'Jake', kind: 'call', risk: 0.55, chip: 'Low stakes, no date', stakes: 1, age: 9, tier: 'remember', p: 0.74,
      f: [['No date given', 0.47, 38], ['To friends', 0.49, 61]],
    }),
    mk({
      t: 'Problem set 4',
      q: '\u201cProblem set four is due Friday at noon.\u201d',
      who: 'Prof. Alder', kind: 'class', risk: 0.18, chip: 'Clear deadline', stakes: 3, age: 2, tier: 'execute', p: 0.88, due: 3,
      rule: 'bee-todo',
      f: [['Class deadlines', 0.92, 71], ['Problem sets', 0.96, 24]],
    }),
    mk({
      t: 'Read chapter 4',
      q: '\u201cRead chapter four before Tuesday.\u201d',
      who: 'Prof. Alder', kind: 'class', risk: 0.42, chip: 'You skip readings', stakes: 2, age: 3, tier: 'ask', p: 0.58, due: 4,
      f: [['Assigned readings', 0.58, 47], ['Tuesday deadlines', 0.66, 31]],
    }),
    mk({
      t: 'Send the reading response',
      q: '\u201cI\u2019ll send the reading response tomorrow morning.\u201d',
      who: 'Prof. Alder', kind: 'email', risk: 0.35, chip: 'Due tomorrow', stakes: 2, age: 1, tier: 'draft', p: 0.66, due: 1,
      f: [['\u201ctomorrow\u201d promises', 0.63, 34], ['To professors', 0.81, 27]],
    }),
    mk({
      t: 'Ask Priya for the lab notes',
      q: '\u201cI should ask Priya for the lab notes.\u201d',
      who: 'Priya', kind: 'call', risk: 0.66, chip: 'No date was stated', stakes: 2, age: 6, tier: 'ask', p: 0.61, rule: 'shared-intent',
      f: [['\u201cI should\u201d promises', 0.38, 52], ['Study group', null, 8]],
    }),

    // --- this week, closed ------------------------------------------------
    mk({ t: 'Notes to the study group', who: 'Group', kind: 'call', risk: 0.12, stakes: 2, age: 4, state: 'done', tier: 'execute', p: 0.9, ev: 'Confirmed in Sent, Oct 15' }),
    mk({ t: 'Confirm Thursday call', who: 'Ravi', kind: 'call', risk: 0.15, stakes: 2, age: 2, state: 'done', tier: 'execute', p: 0.91, ev: 'Calendar event written' }),
    mk({ t: 'Submit problem set 3', who: 'Prof. Alder', kind: 'class', risk: 0.1, stakes: 3, age: 6, state: 'done', tier: 'execute', p: 0.94, ev: 'Gradescope receipt, Oct 14' }),

    // --- this week, slipped -----------------------------------------------
    mk({ t: 'Book the study room', who: 'Group', kind: 'call', risk: 0.7, chip: 'No date was stated', stakes: 2, age: 6, state: 'obsolete', tier: 'ignore', p: 0.55, ev: 'No booking found after 7 days' }),

    // --- last week --------------------------------------------------------
    mk({ t: 'Send the travel receipt', who: 'Ops', kind: 'email', risk: 0.2, stakes: 1, age: 10, state: 'done', tier: 'execute', p: 0.89, ev: 'Confirmed in Sent, Oct 9' }),
    mk({ t: 'Reply to Maya', who: 'Maya', kind: 'call', risk: 0.35, stakes: 2, age: 12, state: 'done', tier: 'execute', p: 0.84, ev: 'Confirmed in Sent, Oct 8' }),
    mk({ t: 'Lab write-up', who: 'Lab', kind: 'class', risk: 0.3, stakes: 3, age: 9, state: 'done', tier: 'execute', p: 0.87, ev: 'Submitted, Oct 10' }),
    mk({ t: 'Call Alex back', who: 'Alex', kind: 'call', risk: 0.66, chip: 'No date was stated', stakes: 1, age: 13, state: 'obsolete', tier: 'ignore', p: 0.6, ev: 'No call found after 7 days' }),

    // --- two weeks ago ----------------------------------------------------
    mk({ t: 'Send the deck to Priya', who: 'Priya', kind: 'email', risk: 0.22, stakes: 3, age: 17, state: 'done', tier: 'execute', p: 0.9, ev: 'Confirmed in Sent, Oct 3' }),
    mk({ t: 'Intro Sam to Priya', who: 'Sam', kind: 'call', risk: 0.58, chip: 'No date was stated', stakes: 2, age: 18, state: 'obsolete', tier: 'ignore', p: 0.57, ev: 'No intro email found' }),
    mk({ t: 'Reading response', who: 'Prof. Alder', kind: 'class', risk: 0.4, stakes: 2, age: 16, state: 'done', tier: 'execute', p: 0.79, ev: 'Submitted, Oct 4' }),
    mk({ t: 'Pay Maya back', who: 'Maya', kind: 'call', risk: 0.18, stakes: 2, age: 19, state: 'done', tier: 'execute', p: 0.92, ev: 'Transfer confirmed, Oct 1' }),

    // --- three weeks ago --------------------------------------------------
    mk({ t: 'Office hours Thursday', who: 'Prof. Alder', kind: 'class', risk: 0.2, stakes: 2, age: 24, state: 'done', tier: 'execute', p: 0.88, ev: 'Added to the calendar' }),
    mk({ t: 'Reschedule coffee', who: 'Alex', kind: 'call', risk: 0.5, chip: 'No date was stated', stakes: 1, age: 26, state: 'obsolete', tier: 'ignore', p: 0.62, ev: 'No message found' }),
    mk({ t: 'Send the resume', who: 'Career', kind: 'email', risk: 0.3, stakes: 3, age: 23, state: 'done', tier: 'execute', p: 0.85, ev: 'Confirmed in Sent, Sept 27' }),
    mk({ t: 'Ask the landlord about the lease', who: 'Landlord', kind: 'call', risk: 0.72, chip: 'Vague time', stakes: 2, age: 27, state: 'obsolete', tier: 'ignore', p: 0.64, ev: 'No message found' }),
  ];
}

function todayBlock(list) {
  const open = list.filter((item) => item.state === 'live');
  const live = open.filter((item) => item.age <= 7);
  const closed = list.filter((item) => item.state === 'done' && item.age <= 7);

  const longest = Math.max(...open.map((item) => item.age), 1);
  const ranked = [...open]
    .sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0) || b.age - a.age)
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      reason: item.reason || 'Open, with no other signal',
      openDays: item.age,
      bar: Math.round(item.risk * 100),
      rank: item.risk > 0.6 ? 0 : item.risk > 0.3 ? 1 : 2,
    }));

  const weeks = [];
  for (let week = 0; week < 4; week += 1) {
    const from = week * 7;
    const to = from + 7;
    const inBucket = (age) => (week === 3 ? age >= from : age >= from && age < to);
    weeks.push({
      week,
      label: week === 0 ? 'This week' : week === 1 ? 'Last week' : week === 3 ? '3+ weeks ago' : `${week} weeks ago`,
      open: open.filter((item) => inBucket(item.age)).length,
      kept: list.filter((item) => item.state === 'done' && inBucket(item.age)).length,
      slipped: list.filter((item) => item.state === 'obsolete' && inBucket(item.age)).length,
    });
  }

  return {
    windowDays: 7,
    madeThisWeek: list.filter((item) => item.age <= 7).length,
    fromConversations: list.filter((item) => item.age <= 7 && item.sourceKind !== 'todo').length,
    openCount: open.length,
    likelyToSlip: ranked,
    strongestOpenDays: longest,
    signalled: ranked.length,
    closedThisWeek: closed.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      proof: item.evidence || 'Closed',
      at: item.closedBy?.at || null,
    })),
    closedThisWeekTotal: closed.length,
    baseRate: { done: 308, total: 489, rate: 0.63, source: 'Promise history' },
    capacity: { open: open.length, norm: 6, provisional: false, days: 28, minimumDays: 7 },
    kinds: [
      { kind: 'call', count: list.filter((item) => item.sourceKind === 'call').length },
      { kind: 'class', count: list.filter((item) => item.sourceKind === 'class').length },
      { kind: 'email', count: list.filter((item) => item.sourceKind === 'email').length },
      { kind: 'todo', count: list.filter((item) => item.sourceKind === 'todo').length },
    ],
    risk: { available: true, why: 'Slip risk is the fitted follow-through model on this person\u2019s history.' },
    // Live capture is the one thing the preview shows that the real client
    // cannot: the synthetic badge on screen says so on every screen.
    listening: { since: hoursAgo(0.05), seconds: 168, topic: 'Thursday\u2019s plans' },
    greeting: 'Good morning',
    weeks,
  };
}

function recordBlock() {
  return {
    span: { from: daysAgo(365), to: daysAgo(0), days: 365 },
    kept: { done: 194, settled: 308, total: 489, rate: 0.63 },
    todoRate: { done: 308, total: 489, rate: 0.63 },
    phrases: [
      { rule: 'p1', label: '\u201cI\u2019ll send it tonight\u201d', total: 64, done: 58, rate: 0.91, enough: true },
      { rule: 'p2', label: '\u201cby Friday\u201d', total: 41, done: 34, rate: 0.84, enough: true },
      { rule: 'p3', label: '\u201cI\u2019ll confirm\u201d', total: 33, done: 27, rate: 0.82, enough: true },
      { rule: 'p4', label: '\u201cI should\u201d', total: 52, done: 20, rate: 0.38, enough: true },
      { rule: 'p5', label: '\u201clet me try\u201d', total: 29, done: 13, rate: 0.44, enough: true },
      { rule: 'p6', label: '\u201csometime\u201d', total: 18, done: 4, rate: 0.21, enough: true },
      { rule: 'p7', label: '\u201cI\u2019ll look at\u201d', total: 6, done: 3, rate: 0.5, enough: false },
      { rule: 'p8', label: '\u201cremind me\u201d', total: 4, done: 1, rate: 0.25, enough: false },
    ],
    audiences: [
      { person: 'Professors', total: 71, done: 58, rate: 0.81, enough: true },
      { person: 'Work', total: 44, done: 32, rate: 0.72, enough: true },
      { person: 'Family', total: 19, done: 13, rate: 0.66, enough: true },
      { person: 'Friends', total: 61, done: 30, rate: 0.49, enough: true },
      { person: 'Group projects', total: 13, done: 7, rate: 0.54, enough: true },
      { person: 'Landlord', total: 4, done: 1, rate: 0.25, enough: false },
    ],
    minimumN: 10,
    hiddenPhrases: 2,
    hours: {
      available: true,
      bars: [70, 78, 74, 66, 60, 52, 40, 30],
      from: '8 am',
      to: '10 pm',
      note: 'Evening promises slip most.',
    },
    calibration: {
      available: true,
      points: [[0.1, 0.12], [0.3, 0.27], [0.5, 0.55], [0.7, 0.66], [0.9, 0.88]],
      heldOut: 'your last two months, which the model never saw',
      error: { before: 0.14, after: 0.04 },
    },
    finding: {
      title: 'Evening promises slip most',
      body: 'Promises made after 8 pm are kept 30% of the time. Before noon, 74%.',
    },
    greeting: 'Your word versus your record',
  };
}

function trustBlock(list) {
  const conversations = list
    .filter((item) => item.sourceKind !== 'todo')
    .slice(0, 6)
    .map((item, index) => ({
      id: `pvconv${index}`,
      at: item.createdAt,
      kept: 40 + index * 7,
      droppedOther: 9 + index * 3,
      droppedEmpty: 2,
      redaction: index % 3 === 0 ? 'assumed-single-speaker' : 'profile-name-match',
      summary: null,
    }));

  return {
    conversations: conversations.length,
    conversationCount: conversations.length,
    utterancesKept: 1_284,
    utterancesDroppedOther: 412,
    utterancesDroppedEmpty: 37,
    assumedSingleSpeaker: 2,
    nameMatched: 4,
    othersRetained: 0,
    namesRedacted: 96,
    keptRule: 'Your words and the minimum context around them.',
    conversationList: conversations,
    transcript: [
      { speaker: 'you', text: 'I should email Dr. Rao about the extension.' },
      { speaker: 'other' },
      { speaker: 'you', text: 'I\u2019ll take section 3 by Friday.' },
      { speaker: 'other' },
      { speaker: 'you', text: 'Read chapter four before Tuesday.' },
    ],
    preview: true,
  };
}

export function previewLedger() {
  const list = items();
  return {
    owner: 'Max',
    timezone: 'America/New_York',
    connected: true,
    lastRun: hoursAgo(0.2),
    cursor: 'pv-cursor',
    sync: {
      kind: 'ingest',
      title: 'Bee sync',
      detail: 'incremental: 3 conversations, 4 todos, 2 facts',
      at: hoursAgo(0.2),
    },
    stats: {
      total: list.length,
      open: list.filter((item) => item.state === 'live').length,
      drafts: list.filter((item) => item.decision === 'draft' && item.state === 'live').length,
      asks: list.filter((item) => item.decision === 'ask' && item.state === 'live').length,
      handled: list.filter((item) => item.state === 'done').length,
      obsolete: list.filter((item) => item.state === 'obsolete').length,
      unscored: 0,
    },
    privacy: {
      conversations: 6,
      utterancesKept: 1_284,
      utterancesDroppedOther: 412,
      utterancesDroppedEmpty: 37,
      assumedSingleSpeaker: 2,
      nameMatched: 4,
    },
    items: list,
    plans: [],
    receipts: [
      { kind: 'draft', title: 'Draft prepared', detail: 'Email Dr. Rao about the extension \u00b7 nothing sent', at: hoursAgo(0.1), decision: 'draft' },
      { kind: 'execute', title: 'Marked complete', detail: 'Notes to the study group', at: hoursAgo(20), decision: 'execute' },
      { kind: 'ask', title: 'Held back for you', detail: 'Write section 3 \u00b7 fourth promise this week', at: hoursAgo(26), decision: 'ask' },
      { kind: 'ingest', title: 'Bee sync', detail: 'incremental: 3 conversations, 4 todos, 2 facts', at: hoursAgo(0.2), decision: 'ingest' },
    ],
    decisions: ['draft', 'ask', 'remember', 'execute', 'ignore', 'unscored'],
    options: ['ignore', 'remember', 'ask', 'draft', 'execute'],
    norms: { load: 9, norm: 6, days: 28, minimumDays: 7, provisional: false },
    bankruptcy: {
      count: list.filter((item) => item.state === 'obsolete').length,
      ids: list.filter((item) => item.state === 'obsolete').map((item) => item.id),
    },
    negotiation: [],
    today: todayBlock(list),
    record: recordBlock(),
    trust: trustBlock(list),
    preview: true,
    totals: {
      commitments: list.length,
      live: list.filter((item) => item.state === 'live').length,
      conversations: 6,
      utterances: 1_284,
      facts: 22,
      beeTodos: 9,
      labels: { tier: TIER_LABEL.draft },
    },
  };
}
