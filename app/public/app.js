// app.js — the client. It talks only to the local API, writes no inline styles
// and binds no inline handlers, so the page runs under a strict
// Content-Security-Policy. Every value it draws comes from the ledger; where
// the ledger has no value it says so and draws nothing in its place.

const state = {
  token: null,
  ledger: null,
  tab: 'horizon-screen',
  filter: 'all',
  visible: 14,
  editId: null,
  undo: null,
  undoTimer: null,
  horizonTrade: null,
};

/* --- tiny helpers --------------------------------------------------------- */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

/** Confidence is a probability in [0,1]; a few older rows hold a percent. */
function probOf(item) {
  const value = item.confidence;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
}

const percent = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—');

/** Counts over a year are unreadable without separators. */
const num = (value) => (Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '—');

const OPTIONS = ['ignore', 'remember', 'ask', 'draft', 'execute'];

const OPTION_LABEL = {
  ignore: 'Leave it',
  remember: 'Remember',
  ask: 'Ask first',
  draft: 'Draft',
  execute: 'Do it',
};

const OPTION_ACTION = {
  ignore: 'Does nothing',
  remember: 'Keeps it',
  ask: 'Asks you first',
  draft: 'Writes a draft',
  execute: 'Acts',
};

const DECISION_LABEL = {
  draft: 'Draft',
  ask: 'Held back',
  remember: 'Remembered',
  execute: 'Closed',
  ignore: 'Retired',
  unscored: 'Unscored',
  ingest: 'Sync',
};

const GATE_TITLE = {
  ask: 'Paused for your decision',
  draft: 'Draft only',
  execute: 'Closed',
  remember: 'No interruption',
  ignore: 'No action',
  unscored: 'Not decided yet',
};

const KIND_LABEL = { call: 'a call', class: 'a lecture', email: 'an email', todo: 'a todo', unspecified: 'the ledger' };

/* --- glyphs --------------------------------------------------------------
   Phosphor's 256-box solids, checked in with the app, plus a small 24-box
   stroke set for sources. There is no robot and no sparkle anywhere. */

const ICON_PATHS = {
  draft:
    '<path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"/>',
  ask: '<path d="M188,88a27.75,27.75,0,0,0-12,2.71V60a28,28,0,0,0-41.36-24.6A28,28,0,0,0,80,44v6.71A27.75,27.75,0,0,0,68,48,28,28,0,0,0,40,76v76a88,88,0,0,0,176,0V116A28,28,0,0,0,188,88Zm12,64a72,72,0,0,1-144,0V76a12,12,0,0,1,24,0v44a8,8,0,0,0,16,0V44a12,12,0,0,1,24,0v68a8,8,0,0,0,16,0V60a12,12,0,0,1,24,0v68.67A48.08,48.08,0,0,0,120,176a8,8,0,0,0,16,0,32,32,0,0,1,32-32,8,8,0,0,0,8-8V116a12,12,0,0,1,24,0Z"/>',
  execute:
    '<path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>',
  remember:
    '<path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.77,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.77-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z"/>',
  ignore:
    '<path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"/>',
  unscored:
    '<path d="M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64ZM72,40H184V75.64L178.23,80H77.33L72,76Zm56,78L98.67,96h58.4Zm56,98H72V180l48-36v24a8,8,0,0,0,16,0V144.08l48,36.28Z"/>',
  agent:
    '<path d="M224,128a96,96,0,0,1-94.71,96H128A95.38,95.38,0,0,1,62.1,197.8a8,8,0,0,1,11-11.63A80,80,0,1,0,71.43,71.39a3.07,3.07,0,0,1-.26.25L44.59,96H72a8,8,0,0,1,0,16H24a8,8,0,0,1-8-8V56a8,8,0,0,1,16,0V85.8L60.25,60A96,96,0,0,1,224,128Z"/>',
  quote:
    '<path d="M116,72v88a48.05,48.05,0,0,1-48,48,8,8,0,0,1,0-16,32,32,0,0,0,32-32H68a16,16,0,0,1-16-16V72A16,16,0,0,1,68,56h32A16,16,0,0,1,116,72Zm108,0v88a48.05,48.05,0,0,1-48,48,8,8,0,0,1,0-16,32,32,0,0,0,32-32H176a16,16,0,0,1-16-16V72a16,16,0,0,1,16-16h32A16,16,0,0,1,224,72Z"/>',
  arrow:
    '<path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/>',
};

/** The source of a row, as a stroke glyph on a 24-box. */
const SOURCE_GLYPH = {
  call: '<path d="M6.5 4h3l1.6 4-2 1.4a11 11 0 0 0 5.5 5.5l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>',
  class: '<path d="M12 4 2.8 8.4 12 12.8l9.2-4.4Z"/><path d="M6.6 10.5v4.6c0 1 2.4 2.6 5.4 2.6s5.4-1.6 5.4-2.6v-4.6"/><path d="M21.2 8.4v5.4"/>',
  email: '<rect x="3" y="5.5" width="18" height="13" rx="2.6"/><path d="m4 7.5 8 5.5 8-5.5"/>',
  todo: '<rect x="4" y="4" width="16" height="16" rx="3.4"/><path d="m8.4 12.2 2.6 2.6 4.8-5"/>',
  unspecified: '<path d="M12 4.2 3.6 19h16.8Z"/>',
};

function icon(name) {
  const path = ICON_PATHS[name];
  return path ? `<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${path}</svg>` : '';
}

function sourceGlyph(kind) {
  const path = SOURCE_GLYPH[kind] || SOURCE_GLYPH.unspecified;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/** The small 24-box stroke set used by the actions, rather than the sources. */
const UI_GLYPH = {
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.6"/><path d="m4 7.5 8 5.5 8-5.5"/>',
  cal: '<rect x="3.4" y="5" width="17.2" height="15.2" rx="3.2"/><path d="M3.4 10h17.2"/><path d="M8 3.2v3.4M16 3.2v3.4"/>',
  clock: '<path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.6 4.6v3.9h3.9"/><path d="M12 8.2v4.2l2.9 1.7"/>',
};

function uiGlyph(name) {
  const path = UI_GLYPH[name];
  return path
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
    : '';
}

/* --- names, faces ---------------------------------------------------------
   A person keeps one tint everywhere because the tint is a hash of the name. */

function initials(name) {
  const words = String(name || '')
    .replace(/\b(dr|prof|mr|ms|mrs)\.?\s*/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '—';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function avTint(name) {
  let hash = 0;
  for (const character of String(name || '?')) hash = (hash * 31 + character.codePointAt(0)) % 997;
  return (hash % 6) + 1;
}

function avatar(name, extra = '') {
  return `<span class="av av-${avTint(name)} ${extra}" aria-hidden="true">${escapeHTML(initials(name))}</span>`;
}

/** Which face belongs to a row: the counterparty, or the wearer. */
function faceOf(item) {
  return item.person || state.ledger?.owner || 'You';
}

/* --- dates ---------------------------------------------------------------- */

function stampDate(item) {
  const source =
    item.state === 'done' || item.decision === 'ignore' ? item.closedBy?.at || item.createdAt : item.createdAt;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stampOf(item) {
  const date = stampDate(item);
  if (!date) return '';
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dayLabel(date) {
  const midnight = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function dayGroups(items, render, keyOf = stampDate) {
  const groups = new Map();
  for (const item of items) {
    const date = keyOf(item);
    const label = date && !Number.isNaN(date.getTime()) ? dayLabel(date) : 'Undated';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return [...groups]
    .map(
      ([label, rows]) => `
      <div class="day-group"><span>${escapeHTML(label)}</span><span>${rows.length}</span></div>
      ${rows.map(render).join('')}`,
    )
    .join('');
}

const empty = (text) => `<p class="empty">${escapeHTML(text)}</p>`;

/* --- a shared row ---------------------------------------------------------
   One commitment, one sentence, one source, one move. Used by Today and by the
   ledger list on Trust, so a row looks the same everywhere it appears. */

function confBar(item) {
  const p = probOf(item);
  const filled = p === null ? 0 : Math.max(1, Math.round(p * 5));
  const segments = Array.from({ length: 5 }, (_, index) => `<i class="${index < filled ? 'on' : ''}"></i>`).join('');
  return `<span class="conf"><span class="conf-bar" aria-hidden="true">${segments}</span><span class="conf-num">${
    p === null ? 'No score' : `${Math.round(p * 100)}%`
  }</span></span>`;
}

/** The one move a row offers, as a pill with an icon. Nothing else. */
function rowChipButtons(item) {
  const open = item.state === 'live' || item.state === 'blocked';
  if (!open) return '';
  if (item.state === 'blocked') return '<span class="chip warn">Blocked</span>';
  if (item.decision === 'ask') {
    return `<button class="chip do" type="button" data-act="approve" data-id="${escapeHTML(item.id)}">${uiGlyph('mail')}Draft a reply</button>`;
  }
  if (item.decision === 'draft') {
    return `<button class="chip do" type="button" data-act="approve" data-id="${escapeHTML(item.id)}">${icon('execute')}Mark it done</button>`;
  }
  if (item.decision === 'unscored') {
    return `<button class="chip do" type="button" data-act="decide" data-id="${escapeHTML(item.id)}">${icon('unscored')}Decide</button>`;
  }
  return '';
}

function rowChips(item) {
  const open = item.state === 'live' || item.state === 'blocked';
  const chips = [];
  const move = rowChipButtons(item);
  if (move) chips.push(move);
  if (item.scheduled) chips.push(`<span class="chip">Scheduled ${escapeHTML(item.scheduled)}</span>`);
  if (item.person) chips.push(`<span class="chip quiet">${escapeHTML(item.person)}</span>`);
  if (item.dueDay) chips.push(`<span class="chip quiet">Due ${escapeHTML(item.dueDay)}</span>`);
  if (!open) chips.push(`<span class="chip quiet">${escapeHTML(DECISION_LABEL[item.decision] || 'Closed')}</span>`);
  return chips.length ? `<div class="chips">${chips.join('')}</div>` : '';
}

function row(item) {
  return `
    <article class="card row">
      ${avatar(faceOf(item))}
      <div class="row-body">
        <button class="row-open" type="button" data-item="${escapeHTML(item.id)}">
          <span class="card-title">${escapeHTML(item.title)}</span>
          <span class="row-meta">
            <span class="src" aria-hidden="true">${sourceGlyph(item.sourceKind)}</span>
            <span class="row-when">${escapeHTML(stampOf(item))}</span>
          </span>
        </button>
        ${confBar(item)}
        ${rowChips(item)}
      </div>
    </article>`;
}

/* --- one number, one bar ------------------------------------------------- */

function bar(width, tone = '') {
  const value = Math.max(0, Math.min(100, Math.round(width)));
  return `<span class="b ${tone}"><u data-width="${value}"></u></span>`;
}

function paintBars(root = document) {
  root.querySelectorAll('[data-width]').forEach((element) => {
    element.style.width = `${element.dataset.width}%`;
  });
}

/* ======================================================================== */
/* TODAY                                                                    */
/* ======================================================================== */

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function horizonDate(value) {
  const day = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00`) : new Date(NaN);
}

function horizonDueItems() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return (state.ledger.items || [])
    .filter((item) => {
      if (!['live', 'blocked'].includes(item.state) || !item.dueAt) return false;
      const due = horizonDate(item.dueAt);
      return due >= start && due < end;
    })
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}

function horizonSimulation(count, rate) {
  if (!count || typeof rate !== 'number' || !Number.isFinite(rate)) return null;
  // A fixed seed makes the same ledger produce the same 160-week forecast.
  let seed = (count * 2654435761 + Math.round(rate * 10000) + 17) >>> 0;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let clean = 0;
  const weeks = Array.from({ length: 160 }, (_, week) => {
    let clear = true;
    for (let promise = 0; promise < count; promise += 1) {
      if (random() >= rate) clear = false;
    }
    if (clear) clean += 1;
    return { week, clear };
  });
  return { weeks, clean, chance: clean / weeks.length };
}

function renderHorizonMap(due) {
  const svg = $('#horizon-map');
  const width = 760;
  const center = 390;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const past = (state.ledger.items || [])
    .filter((item) => item.origin === 'conversation')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(-18);
  const dots = past.map((item, index) => {
    const x = 38 + (index / Math.max(1, past.length - 1)) * (center - 78);
    const y = 54 + ((index * 47) % 148);
    const dueDate = item.dueAt ? horizonDate(item.dueAt) : null;
    const days = dueDate ? Math.max(0, Math.min(7, (dueDate - start) / 86400000)) : -1;
    const targetX = days >= 0 ? center + 34 + (days / 7) * 280 : center;
    const targetY = days >= 0 ? 56 + ((index * 31) % 138) : 130;
    const trade = state.horizonTrade === item.id;
    return `<path class="horizon-thread${trade ? ' is-trade' : ''}" d="M${x.toFixed(1)} ${y} Q${((x + targetX) / 2).toFixed(1)} ${(Math.min(y, targetY) - 48).toFixed(1)} ${targetX.toFixed(1)} ${targetY}" />
      <circle class="horizon-bead" cx="${x.toFixed(1)}" cy="${y}" r="${trade ? 5 : 3.5}" />`;
  }).join('');
  const fan = Array.from({ length: 17 }, (_, index) => {
    const y = 130 + (index - 8) * 12;
    const edgeY = 20 + index * 13.7;
    const selected = index === 8;
    return `<path class="horizon-fan${selected ? ' is-peak' : ''}" d="M${center} 130 Q${center + 96} ${y - 7} ${width - 12} ${edgeY}" />`;
  }).join('');
  const future = due.map((item, index) => {
    const date = horizonDate(item.dueAt);
    const days = Math.max(0, Math.min(7, (date - start) / 86400000));
    const x = center + 34 + (days / 7) * 280;
    const y = 64 + ((index * 37) % 126);
    const selected = state.horizonTrade === item.id;
    return `<path class="horizon-promise${selected ? ' is-trade' : ''}" d="M${center} 130 Q${(center + (x - center) / 2).toFixed(1)} ${(y - 38).toFixed(1)} ${x.toFixed(1)} ${y}" />
      <circle class="horizon-due-dot${selected ? ' is-trade' : ''}" cx="${x.toFixed(1)}" cy="${y}" r="${selected ? 7 : 5}" />`;
  }).join('');
  svg.innerHTML = `<title>Promises move from conversations in your past toward their due dates in the week ahead.</title>
    <defs><linearGradient id="horizon-ribbon" x1="0" x2="1"><stop offset="0" stop-color="var(--lav)" stop-opacity="0.04"/><stop offset="1" stop-color="var(--lav)" stop-opacity="0.42"/></linearGradient></defs>
    <path class="horizon-band" d="M${center} 130 C${center + 100} 46 ${width - 90} 19 ${width - 10} 20 L${width - 10} 240 C${width - 90} 239 ${center + 100} 214 ${center} 130Z" />
    ${fan}${dots}<path class="horizon-today-line" d="M${center} 20V240"/>${future}
    <circle class="horizon-today-dot" cx="${center}" cy="130" r="7"/>`;
}

function renderHorizon() {
  const due = horizonDueItems();
  const rate = state.ledger.today?.baseRate?.rate;
  const simulation = horizonSimulation(due.length, rate);
  const trade = due[0] || null;
  const shown = state.horizonTrade ? due.find((item) => item.id === state.horizonTrade) : null;
  const effectiveCount = Math.max(0, due.length - (shown ? 1 : 0));
  const adjusted = horizonSimulation(effectiveCount, rate);
  const owner = state.ledger.owner || 'you';

  $('#horizon-avatar').textContent = owner.slice(0, 1).toUpperCase();
  $('#horizon-sub').textContent = due.length
    ? `${due.length} promise${due.length === 1 ? '' : 's'} come due. Latent traced them forward from what you said.`
    : 'No promise has a due date this week. Your past is here; the future stays open.';
  $('#horizon-score').textContent = simulation ? percent(simulation.chance) : '—';
  $('#horizon-score-note').textContent = simulation
    ? `Base-rate scenario · ${due.length} dated ${due.length === 1 ? 'promise' : 'promises'}`
    : 'No dated promises to score';
  $('#horizon-sample').textContent = simulation ? '160 weeks simulated' : 'Forecast waiting';
  $('#horizon-explainer').textContent = simulation
    ? `A simple scenario from Bee’s recorded close rate (${percent(rate)}). It samples 160 possible weeks; this is a base rate, not a calibrated personal forecast.`
    : 'Latent will draw a forecast when Bee has a dated promise in this week. An empty calendar is not treated as a clear week.';
  $('#horizon-spark').innerHTML = simulation
    ? simulation.weeks.map((week) => `<i class="${week.clear ? 'is-clear' : ''}"></i>`).join('')
    : '<span class="horizon-spark-empty">—</span>';
  $('#horizon-due-count').textContent = due.length ? `${due.length} this week` : 'Nothing dated';
  $('#horizon-due-list').innerHTML = due.length ? due.map((item) => {
    const selected = state.horizonTrade === item.id;
    return `<button class="horizon-row${selected ? ' is-trade' : ''}" type="button" data-item="${escapeHTML(item.id)}">
      <span class="horizon-row-date">${escapeHTML(horizonDate(item.dueAt).toLocaleDateString('en-US', { weekday: 'short' }))}</span>
      <span class="horizon-row-copy"><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.source || 'From your record')}</small></span>
      <span class="horizon-row-arrow" aria-hidden="true">↗</span>
    </button>`;
  }).join('') : '<div class="card empty"><p>No dated promises are coming due in the next seven days.</p><p class="note">Older and undated promises remain in your record. Latent leaves them out of this forecast.</p></div>';
  if (shown) {
    $('#trade-note').textContent = `Setting aside “${shown.title}” changes the base-rate scenario to ${adjusted ? percent(adjusted.chance) : '—'}. Nothing is changed in Bee.`;
    $('#trade-btn').textContent = 'Clear trade';
    $('#trade-btn').dataset.clearTrade = 'true';
  } else {
    $('#trade-note').textContent = trade
      ? `See the effect of setting aside “${trade.title}”. Nothing changes until you choose it.`
      : 'Add due dates in Bee to compare the week ahead.';
    $('#trade-btn').textContent = 'Show the trade';
    delete $('#trade-btn').dataset.clearTrade;
  }
  const question = due[0];
  $('#horizon-question').innerHTML = question
    ? `<span class="horizon-question-mark">?</span><div><b>One thing to keep in view</b><p>“${escapeHTML(question.title)}” is due ${escapeHTML(horizonDate(question.dueAt).toLocaleDateString('en-US', { weekday: 'long' }))}. Does that still fit this week?</p><button class="text-btn" type="button" data-item="${escapeHTML(question.id)}">Open its receipt <span aria-hidden="true">↗</span></button></div>`
    : '<div><b>One question, when there is one</b><p>Latent will bring forward a single promise when the record gives it a date. You do not need to sort the whole list.</p></div>';
  renderHorizonMap(due);
}

function renderToday() {
  const ledger = state.ledger;
  const today = ledger.today || {};

  $('#owner-name').textContent = (ledger.owner || 'there').split(/\s+/)[0];
  $('#greeting').textContent = today.greeting || timeGreeting();

  // One wearer, one face. The same initials and the same glass circle ride on
  // all four heroes, so the person is the same person wherever you are.
  const face = ledger.owner ? initials(ledger.owner) : '—';
  $$('#me-avatar, #twin-avatar, #record-avatar, #trust-avatar').forEach((element) => {
    element.textContent = face;
  });

  // The connection pill. A dot only ever means Bee is reachable, and the label
  // is the age of the last read rather than a battery figure this app cannot see.
  const stamp = ledger.sync?.at || ledger.lastRun;
  $('#acct-pill').innerHTML = ledger.connected
    ? `<span class="dot"></span><span id="acct-text">Bee${stamp ? ` · ${escapeHTML(ago(stamp))}` : ' · connected'}</span>`
    : '<span id="acct-text">Bee not connected</span>';

  const parts = [];
  if (Number.isFinite(today.openCount)) {
    parts.push(`${today.openCount} open todo${today.openCount === 1 ? '' : 's'}`);
  }
  if (today.baseRate) {
    parts.push(`${today.baseRate.done} done`);
    parts.push(`you close ${percent(today.baseRate.rate)}`);
  }
  $('#today-sub').textContent = parts.length ? `${parts.join(' · ')}.` : 'Bee has not been read yet on this machine.';

  renderLive();
  renderNudge();
  renderWeekStrip();
  renderSlip();
  renderAgents();
  renderReceipts();
  renderClosed();
  renderBee();
}

/** The wearer's own clock, as mm:ss. */
function clock(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function ago(value) {
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return '';
  const minutes = Math.round((Date.now() - stamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Live capture is the one thing this build cannot do: Bee's API returns
 * completed conversations, not a stream. The line is drawn only when a source
 * says a conversation is open, which today means the synthetic dataset.
 */
function renderLive() {
  const line = $('#hero-live');
  const listening = state.ledger.today?.listening;
  if (!listening) {
    line.hidden = true;
    line.textContent = '';
    return;
  }
  line.hidden = false;
  line.innerHTML = `<span class="dot"></span><b>Listening</b> ${escapeHTML(clock(listening.seconds))} · ${escapeHTML(
    listening.topic || 'a conversation',
  )}`;
}

function renderNudge() {
  const dupe = (state.ledger.today?.duplicates || [])[0];
  const box = $('#nudge-actions');

  if (dupe) {
    $('#nudge-label').textContent = 'Latent · duplicates';
    $('#nudge-when').textContent = `${dupe.count} copies`;
    $('#nudge-text').textContent = dupe.text;
    box.innerHTML = `
      <button class="btn btn-pri" type="button" data-merge="${escapeHTML(dupe.ids.join(','))}">Merge ${dupe.count}</button>
      ${
        (state.ledger.today?.duplicates || []).length > 1
          ? `<button class="btn" type="button" data-merge-all>Merge all ${state.ledger.today.duplicateRows}</button>`
          : `<button class="btn" type="button" data-item="${escapeHTML(dupe.ids[0])}">Look</button>`
      }`;
    return;
  }

  const risky = (state.ledger.today?.likelyToSlip || [])[0];
  const item = risky ? state.ledger.items.find((entry) => entry.id === risky.id) : null;

  if (!item) {
    $('#nudge-label').textContent = 'Latent';
    $('#nudge-when').textContent = '';
    $('#nudge-text').textContent =
      'Nothing is waiting on you. Every open commitment already has a decision on it.';
    box.innerHTML = '';
    return;
  }

  $('#nudge-label').textContent = 'Latent · next action';
  $('#nudge-when').textContent = risky.openDays ? `${risky.openDays}d open` : 'today';
  $('#nudge-text').textContent = `${item.title}`;
  box.innerHTML = `
    <button class="btn btn-pri" type="button" data-item="${escapeHTML(item.id)}">Review it</button>
    <button class="btn" type="button" data-item="${escapeHTML(item.id)}">Why</button>`;
}

function renderWeekStrip() {
  const weeks = (state.ledger.today?.weeks || []).filter(
    (week) => week.open || week.kept || week.slipped,
  );
  const strip = $('#week-strip');
  // One bucket is not a distribution. When every open row is older than three
  // weeks, the four chips would read 0, 0, 0, 129 and say nothing.
  if (weeks.length < 2) {
    strip.innerHTML = '';
    strip.hidden = true;
    return;
  }
  strip.hidden = false;
  strip.innerHTML = weeks
    .map(
      (week) => `
      <span class="wk">
        <b>${escapeHTML(week.label || `Week ${week.week + 1}`)}</b>
        <span>${week.open} open · ${week.kept} kept${week.slipped ? ` · ${week.slipped} slipped` : ''}</span>
      </span>`,
    )
    .join('');
}

function renderSlip() {
  const today = state.ledger.today || {};
  const risky = today.likelyToSlip || [];
  const on = Boolean(today.risk?.available);
  const list = $('#slip-list');

  $('#slip-note').textContent = on
    ? `${today.signalled ?? risky.length} with a reason`
    : `${risky.length} ordered by what the record says`;
  $('#slip-basis').textContent = on
    ? 'Order follows the fitted follow-through model. The bar is that model\u2019s probability.'
    : today.risk?.why ||
      'No model has been fitted, so rows are ordered by the reason in the record and the bar is days open, against the longest open row here.';

  if (!risky.length) {
    list.innerHTML = empty('No open commitment has a reason attached yet.');
    return;
  }

  list.innerHTML = risky
    .map((entry) => {
      const item = state.ledger.items.find((row) => row.id === entry.id);
      if (!item) return '';
      /* With a model fitted the bar is that model's probability. With no model
         there is nothing to be a probability of, so the bar is the one real
         quantity in the row — how long it has been open — against the longest
         open one on this screen. */
      const fitted = on && Number.isFinite(entry.bar);
      const longest = Math.max(1, ...risky.map((row) => row.openDays || 0));
      const width = fitted ? entry.bar : ((entry.openDays || 0) / longest) * 100;
      const label = fitted ? `${Math.round(entry.bar)}%` : `${entry.openDays || 0} days open`;
      return `
      <article class="card slip">
        <div class="card-row">
          <span class="src" aria-hidden="true">${sourceGlyph(item.sourceKind)}</span>
          <button class="row-open card-title" type="button" data-item="${escapeHTML(item.id)}">${escapeHTML(item.title)}</button>
          <button class="plus" type="button" data-item="${escapeHTML(item.id)}" aria-label="Open ${escapeHTML(item.title)}">+</button>
        </div>
        <div class="risk">
          ${bar(width)}
          <span class="risk-val">${escapeHTML(label)}</span>
        </div>
        <div class="chips">
          <span class="chip quiet">${escapeHTML(entry.reason || 'Open')}</span>
          ${rowChipButtons(item)}
          ${item.scheduled ? `<span class="chip">Scheduled ${escapeHTML(item.scheduled)}</span>` : ''}
          ${item.person ? `<span class="chip quiet">${escapeHTML(item.person)}</span>` : ''}
        </div>
      </article>`;
    })
    .join('');
}

function renderAgents() {
  const ledger = state.ledger;
  const drafts = ledger.items.filter(
    (item) => item.decision === 'draft' && (item.state === 'live' || item.state === 'blocked'),
  );
  $('#negotiation-fact').textContent = `${ledger.plans.length} proposed · ${drafts.length} draft-ready`;

  const select = $('#plan-commitment');
  const previous = select.value;
  const open = ledger.items.filter((item) => item.state === 'live' || item.state === 'blocked');
  select.innerHTML = open.length
    ? open
        .slice(0, 200)
        .map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.title.slice(0, 70))}</option>`)
        .join('')
    : '<option value="">No open commitments</option>';
  if (previous && open.some((item) => item.id === previous)) select.value = previous;

  $('#negotiation-list').innerHTML = (ledger.negotiation || [])
    .map(
      (entry) => `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">${escapeHTML(entry.title)}</h3>
            <p class="lbl">${escapeHTML(entry.date)} · ${escapeHTML(entry.participants.join(' and '))}</p>
          </div>
        </div>
        <div class="timeline">${entry.events.map(timelineEvent).join('')}</div>
      </article>`,
    )
    .join('');

  $('#plan-list').innerHTML = ledger.plans.length
    ? ledger.plans.map(planCard).join('')
    : empty('No plan proposed yet. A plan needs a commitment, a future date, and two names.');
}

function timelineEvent(event) {
  const at = new Date(event.at);
  const when = Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const disclosed = event.disclosed.length ? event.disclosed.join(', ') : 'nothing';
  const withheld = event.withheld.length ? event.withheld.join(', ') : 'nothing';
  const badge = event.simulated ? ' <span class="sim">Simulated</span>' : '';
  return `
    <div class="turn ${event.simulated ? 'simulated' : 'agent'}">
      <div class="turn-head">
        <span class="turn-actor">${escapeHTML(event.actor)}${badge}</span>
        <span class="turn-at">${escapeHTML(when)}</span>
      </div>
      <p class="turn-detail">${escapeHTML(event.title)} ${escapeHTML(event.detail)}</p>
      <p class="turn-fields">
        On the table: <b>${escapeHTML(disclosed)}</b><br />
        Withheld: <b>${escapeHTML(withheld)}</b>
      </p>
    </div>`;
}

function planCard(plan) {
  const id = escapeHTML(plan.id);
  const chips = plan.participants
    .map(
      (name) => `
      <span class="person ${plan.approvals[name] ? 'on' : ''}">
        ${avatar(name, 'av-sm')}${escapeHTML(name)}<b>${plan.approvals[name] ? 'approved' : 'not yet'}</b>
      </span>`,
    )
    .join('');
  const approvals = plan.awaiting
    .map(
      (name) =>
        `<button class="btn" type="button" data-approve="${id}" data-actor="${escapeHTML(name)}">Approve as ${escapeHTML(name)}</button>`,
    )
    .join('');
  const actions =
    plan.state === 'executed'
      ? `<button class="btn btn-pri full-btn" type="button" data-ics="${id}">Download the calendar file</button>`
      : plan.state === 'approved'
        ? `<button class="btn btn-pri full-btn" type="button" data-execute="${id}">Write the calendar file</button>
           <button class="btn full-btn" type="button" data-cancel="${id}">Cancel the plan</button>`
        : plan.state === 'cancelled'
          ? '<p class="note">Cancelled. Your approvals were revoked and no file was written.</p>'
          : `${approvals}<button class="btn full-btn" type="button" data-cancel="${id}">Cancel the plan</button>`;

  const status =
    plan.state === 'cancelled'
      ? { decision: 'ignore', label: 'Cancelled' }
      : plan.state === 'executed'
        ? { decision: 'execute', label: 'Dispatched' }
        : plan.state === 'approved'
          ? { decision: 'draft', label: 'Both approved' }
          : { decision: 'ask', label: `${plan.awaiting.length} approval${plan.awaiting.length === 1 ? '' : 's'} needed` };

  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">${escapeHTML(plan.title)}</h3>
          <p class="lbl">${escapeHTML(plan.date)} · with ${escapeHTML(plan.participants.join(' and '))}</p>
        </div>
        <span class="chip ${escapeHTML(status.decision)}">${escapeHTML(status.label)}</span>
      </div>
      <div class="people">${chips}</div>
      <div class="btn-row">${actions}</div>
    </article>`;
}

function receiptCard(receipt) {
  return `
    <article class="card">
      <div class="receipt">
        <span class="receipt-dot ${escapeHTML(receipt.kind)}" aria-hidden="true"></span>
        <div class="receipt-body">
          <h3>${escapeHTML(receipt.title)}</h3>
          <p>${escapeHTML(receipt.detail)}</p>
        </div>
        <time>${escapeHTML(String(receipt.at).slice(11, 16))}</time>
      </div>
    </article>`;
}

function renderReceipts() {
  const receipts = state.ledger.receipts || [];
  $('#receipts-fact').textContent = `${receipts.length} recorded`;
  $('#receipt-list').innerHTML = receipts.length
    ? dayGroups(receipts.slice(0, 8), receiptCard, (receipt) => new Date(receipt.at))
    : empty('Latent has not acted on anything yet. Approve a commitment and it will be receipted here.');
}

function renderClosed() {
  const today = state.ledger.today || {};
  const rows = today.closedThisWeek || [];
  $('#closed-note').textContent = today.closedThisWeekTotal ? `${today.closedThisWeekTotal} this week` : '';
  $('#closed-list').innerHTML = rows.length
    ? rows
        .map(
          (row) => `
      <div class="proof">
        <span>${escapeHTML(row.title)}</span>
        <span class="lbl">${escapeHTML(row.proof)}</span>
      </div>`,
        )
        .join('')
    : empty('Nothing has been closed this week.');
}

function renderBee() {
  const ledger = state.ledger;
  const privacy = ledger.privacy || {};
  $('#sync-when').textContent = ledger.lastRun ? `Updated ${String(ledger.lastRun).slice(5, 16).replace('T', ' ')}` : '';
  $('#privacy-note').textContent =
    `${privacy.utterancesDroppedOther || 0} utterances from other speakers were counted and discarded before storage. ` +
    `${privacy.utterancesKept || 0} of your own were kept.`;
}

/* ======================================================================== */
/* TWIN                                                                     */
/* ======================================================================== */

function renderTwin() {
  const ledger = state.ledger;
  const norms = ledger.norms || {};
  const open = ledger.items.filter((item) => item.state === 'live' || item.state === 'blocked');
  const today = ledger.today || {};

  $('#twin-pill').textContent = `Open · ${open.length}`;
  const capacity = today.capacity || {};
  $('#twin-sub').textContent =
    capacity.norm && !capacity.provisional
      ? `${open.length} open now. Your four-week norm is ${capacity.norm}.`
      : `${open.length} open now. No four-week baseline has been recorded.`;
  $('#twin-cap').textContent = 'Tap a solid bead to open its receipt.';

  $('#kinds-note').textContent = today.kinds?.length ? `${today.kinds.length} sources` : '';
  $('#kinds-list').innerHTML = today.kinds?.length
    ? today.kinds
        .map((entry) => {
          const share = open.length ? (entry.count / open.length) * 100 : 0;
          return `
          <div class="bar2">
            <span>${escapeHTML(KIND_LABEL[entry.kind] || entry.kind)}</span>
            ${bar(share)}
            <span>${entry.count}</span>
          </div>`;
        })
        .join('')
    : empty('No open commitments carry a source.');

  const scored = ledger.items.some((item) => typeof item.confidence === 'number');
  const staked = ledger.items.some((item) => typeof item.stakes === 'number');
  const rows = [
    ['Distance from the centre', 'Days open. A node farther out has been open longer.'],
    ['Node size', staked ? 'Stakes, as the decision layer scored them.' : 'Equal size — nothing has scored stakes.'],
    ['Ring colour', 'The tier, in that tier\u2019s colour.'],
    ['Node opacity', scored ? 'Confidence, 0 to 100%.' : 'Fixed at 40% — nothing has scored these rows.'],
    ['Two arcs', 'Jev solid, d1 dashed. Overlapping arcs mean the two models chose the same tier.'],
    [
      'Dashed circle',
      norms.norm && !norms.provisional
        ? `Your four-week norm for open load: ${norms.norm} open.`
        : 'No four-week baseline has been recorded yet.',
    ],
  ];
  $('#field-legend').innerHTML = rows
    .map(([name, text]) => `<div class="proof"><span>${escapeHTML(name)}</span><span class="lbl">${escapeHTML(text)}</span></div>`)
    .join('');

  renderLegend();
  renderNextAction();
}

function renderLegend() {
  const ledger = state.ledger;
  const scored = ledger.items.some((item) => typeof item.confidence === 'number');
  const size = ledger.items.some((item) => typeof item.stakes === 'number');
  const entries = [
    ['tier-execute', 'Closed'],
    ['tier-draft', 'Draft'],
    ['tier-ask', 'Held back'],
    ['tier-remember', 'Remember'],
    ['tier-ignore', 'Retired'],
  ];
  $('#twin-legend').innerHTML =
    entries
      .map(([token, label]) => `<span><i class="sw ${token}"></i>${escapeHTML(label)}</span>`)
      .join('') +
    `<span class="legend-note">${scored ? 'Opacity is confidence' : 'No model has scored these'}${size ? ' \u00b7 size is stakes' : ''}</span>`;
}

function renderNextAction() {
  const open = state.ledger.items.filter((item) => item.state === 'live' || item.state === 'blocked');
  const rank = (item) =>
    item.state === 'blocked' ? 0 : item.decision === 'ask' ? 1 : item.decision === 'draft' ? 2 : item.decision === 'unscored' ? 3 : 4;
  const item = [...open].sort((a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : -1))[0];

  if (!item) {
    $('#now-card').innerHTML = `
      <article class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">Nothing is waiting on you.</h3>
            <p class="lbl">Every open commitment already has a decision recorded against it.</p>
          </div>
          ${avatar(state.ledger.owner || 'You')}
        </div>
      </article>`;
    return;
  }

  $('#now-card').innerHTML = `
    <article class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">${escapeHTML(item.title)}</h3>
          <p class="lbl">${escapeHTML(item.policy)}</p>
        </div>
        ${avatar(faceOf(item))}
      </div>
      <div class="chips">
        <span class="chip ${escapeHTML(item.decision)}">${escapeHTML(DECISION_LABEL[item.decision] || 'Unscored')}</span>
        ${item.dueDay ? `<span class="chip quiet">Due ${escapeHTML(item.dueDay)}</span>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn-pri" type="button" data-item="${escapeHTML(item.id)}">Review and decide</button>
      </div>
    </article>`;
}

/* ======================================================================== */
/* RECORD                                                                   */
/* ======================================================================== */

function renderRecord() {
  const record = state.ledger.record || {};
  $('#record-pill').textContent = record.span?.days ? `${record.span.days} days read` : 'No span yet';
  $('#record-sub').textContent = record.span?.days
    ? `Read ${String(record.span.from).slice(0, 10)} to ${String(record.span.to).slice(0, 10)}.`
    : 'Nothing has been read yet, so there is no record to compare against.';

  renderStories(record);
  renderPhrases(record);
  renderAudiences(record);
}

/**
 * A story card. Only the heading of a story is set in the display face, and the
 * headings here are strings this file owns, so none of them can contain a
 * character the display face lacks. Body copy stays in the text face.
 */
function story(tone, title, body) {
  return `
    <article class="story ${tone}">
      <h2>${escapeHTML(title)}</h2>
      ${body}
    </article>`;
}

/** A percentage is written as a bare number: the display face has no % sign. */
function bigNumber(value, line) {
  return `
    <p class="big">${value === null || value === undefined ? '—' : Math.round(value * 100)}</p>
    <p class="story-line">${line}</p>`;
}

function phraseRows(entries) {
  if (!entries.length) return '<p class="story-line">No phrase has enough cases yet.</p>';
  return entries
    .map(
      (entry) => `
      <div class="ph">
        <span>${escapeHTML(entry.label)}</span>
        <b>${percent(entry.rate)} <span class="lbl">n=${entry.total}</span></b>
      </div>`,
    )
    .join('');
}

function renderStories(record) {
  const stories = [];
  const kept = record.kept?.rate;

  stories.push(
    story(
      'y',
      'Your record',
      bigNumber(
        Number.isFinite(kept) ? kept : null,
        Number.isFinite(kept)
          ? `of everything recorded has been closed. ${record.kept.done} of ${record.kept.total} rows.`
          : 'Nothing has been settled yet, so there is no rate to show.',
      ),
    ),
  );

  const enough = (record.phrases || []).filter((entry) => entry.enough);
  stories.push(
    story(
      'l',
      'Phrase by phrase',
      `
      <p class="lbl">Holds best</p>
      ${phraseRows([...enough].sort((a, b) => b.rate - a.rate).slice(0, 2))}
      <p class="lbl">Breaks most</p>
      ${phraseRows([...enough].sort((a, b) => a.rate - b.rate).slice(0, 2))}`,
    ),
  );

  const audiences = (record.audiences || []).slice(0, 4);
  stories.push(
    story(
      'd',
      'Who you keep promises to',
      audiences.length
        ? audiences
            .map(
              (entry) => `
        <div class="bar2">
          <span>${escapeHTML(entry.person)}</span>
          ${bar(entry.enough ? entry.rate * 100 : 0, entry.enough ? '' : 'b-unknown')}
          <span>${entry.enough ? percent(entry.rate) : `n=${entry.total}`}</span>
        </div>`,
            )
            .join('') +
          `<p class="story-line">A rate needs ${record.minimumN} cases. Below that the count is given instead.</p>`
        : '<p class="story-line">No counterparty has been named yet.</p>',
    ),
  );

  stories.push(story('y2', 'When you promise', hoursStory(record.hours || {})));
  stories.push(story('w', 'How well Latent knows you', calibrationStory(record.calibration || {})));

  $('#stories').innerHTML = stories.join('');

  // a bar height cannot be written as a style attribute under this policy
  $$('#stories .hb i[data-h]').forEach((element) => {
    element.style.height = `${element.dataset.h}%`;
  });
}

/**
 * Bee reports whether a todo is done, not when it was done, so the hour of day
 * a promise was kept is not in the data. The card says so rather than drawing a
 * shape with nothing underneath it.
 */
function hoursStory(hours) {
  if (!hours.available) {
    return `<p class="story-line">Not measured yet.</p><p class="note">${escapeHTML(hours.why || '')}</p>`;
  }
  const max = Math.max(1, ...hours.bars);
  const scale = (value) => Math.round((value / max) * 100);
  const labels = hours.bars.map((_, index) =>
    index === 0 ? hours.from : index === hours.bars.length - 1 ? hours.to : '',
  );
  return `
    <div class="hb" aria-hidden="true">${hours.bars.map((value) => `<i data-h="${scale(value)}"></i>`).join('')}</div>
    <div class="hb-x">${labels.map((label) => `<span>${escapeHTML(label)}</span>`).join('')}</div>
    <p class="story-line">Index, not a rate. ${escapeHTML(hours.note || '')}</p>`;
}

function calibrationStory(cal) {
  if (!cal.available) {
    return `<p class="story-line">Not measured yet.</p><p class="note">${escapeHTML(cal.why || '')}</p>`;
  }
  const points = cal.points.map(([x, y]) => `${x * 100},${100 - y * 100}`).join(' ');
  const dots = cal.points.map(([x, y]) => `<circle cx="${x * 100}" cy="${100 - y * 100}" r="4.5" />`).join('');
  return `
    <svg class="cal" viewBox="-6 -6 112 112" role="img" aria-label="Confidence against what actually happened">
      <rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" />
      <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4" opacity="0.35" />
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <g fill="currentColor">${dots}</g>
    </svg>
    <div class="proof"><span>Confidence said</span><span class="lbl">Horizontal</span></div>
    <div class="proof"><span>What happened</span><span class="lbl">Vertical</span></div>
    <div class="proof"><span>Mean error, before</span><b>${percent(cal.error.before)}</b></div>
    <div class="proof"><span>Mean error, after</span><b>${percent(cal.error.after)}</b></div>
    <p class="story-line">Held out: ${escapeHTML(cal.heldOut)}. The model never saw these rows.</p>`;
}

function renderPhrases(record) {
  const rows = record.phrases || [];
  const hidden = record.hiddenPhrases || 0;
  $('#phrases-note').textContent = hidden ? `${hidden} below n=${record.minimumN}` : `n \u2265 ${record.minimumN}`;
  $('#phrase-list').innerHTML = rows.length
    ? rows
        .map(
          (entry) => `
      <div class="ph">
        <span>${escapeHTML(entry.label)}</span>
        ${
          entry.enough
            ? `<b>${percent(entry.rate)}</b>`
            : `<b class="ph-hidden" title="Fewer than ${record.minimumN} cases">Not enough data (n=${entry.total})</b>`
        }
      </div>`,
        )
        .join('')
    : empty('No phrasing has been classified yet.');
}

function renderAudiences(record) {
  const rows = (record.audiences || []).slice(0, 8);
  $('#audience-note').textContent = record.minimumN ? `n \u2265 ${record.minimumN} for a rate` : '';
  $('#audience-list').innerHTML = rows.length
    ? rows
        .map((entry) => {
          const share = entry.enough ? entry.rate * 100 : 0;
          return `
          <div class="bar2">
            <span>${escapeHTML(entry.person)}</span>
            ${bar(share, entry.enough ? '' : 'b-unknown')}
            <span>${entry.enough ? percent(entry.rate) : `n=${entry.total}`}</span>
          </div>`;
        })
        .join('') + `<p class="note">A rate needs ${record.minimumN} cases before it is shown. Below that the count is given instead.</p>`
    : empty('No counterparty has been named yet.');
}

/* ======================================================================== */
/* TRUST                                                                    */
/* ======================================================================== */

function renderTrust() {
  const ledger = state.ledger;
  const trust = ledger.trust || {};
  const privacy = ledger.privacy || {};

  $('#trust-pill').textContent = `${num(trust.conversationCount ?? privacy.conversations ?? 0)} conversations`;
  $('#trust-sub').textContent =
    `${num(privacy.utterancesKept || 0)} of your own utterances were kept, verbatim. ` +
    `${num(privacy.utterancesDroppedOther || 0)} from other speakers were dropped before storage.`;

  $('#privacy-card').innerHTML = `
    <div class="proof"><span>Your utterances kept</span><b>${num(privacy.utterancesKept)}</b></div>
    <div class="proof"><span>Bystander utterances dropped</span><b>${num(privacy.utterancesDroppedOther)}</b></div>
    <div class="proof"><span>Empty utterances dropped</span><b>${num(privacy.utterancesDroppedEmpty)}</b></div>
    <div class="proof"><span>Other people\u2019s words in the database</span><b>${trust.othersRetained ?? 0}</b></div>
    <div class="proof"><span>Conversations read</span><b>${num(trust.conversationCount ?? privacy.conversations ?? 0)}</b></div>
    <div class="proof"><span>Commitments in the ledger</span><b>${num(ledger.items.length)}</b></div>
    ${
      privacy.candidates
        ? `<div class="proof"><span>Conversation-derived rows, not counted</span><b>${num(privacy.candidates)}</b></div>`
        : ''
    }
    <div class="proof"><span>Redaction</span><span class="lbl">${escapeHTML(
      privacy.assumedSingleSpeaker
        ? `${num(privacy.assumedSingleSpeaker)} of ${num(trust.conversationCount ?? privacy.conversations)} assumed one speaker`
        : 'Every conversation matched your name',
    )}</span></div>`;

  const transcript = trust.transcript || [];
  $('#transcript-note').textContent = transcript.length ? `${transcript.length} of yours` : '';
  $('#transcript-card').innerHTML = transcript.length
    ? `<div class="tx">${transcript
        .map((line) =>
          line.speaker === 'you'
            ? `<p class="tx-you"><b>You</b> ${escapeHTML(line.text)}</p>`
            : '<p class="tx-other"><span class="mask">Not stored</span></p>',
        )
        .join('')}</div>
       <p class="note">${escapeHTML(trust.keptRule || 'Your words, and the minimum context around them.')}</p>`
    : empty('No utterance has been stored yet.');

  const conversations = trust.conversationList || [];
  $('#conversation-note').textContent = conversations.length ? `${conversations.length} read` : '';
  $('#conversation-list').innerHTML = conversations.length
    ? conversations
        .slice(0, 12)
        .map(
          (conversation) => `
      <article class="card">
        <div class="card-row">
          <span class="av av-${avTint(conversation.id)}" aria-hidden="true">${escapeHTML(
            conversation.at ? String(new Date(conversation.at).getDate()).padStart(2, '0') : '—',
          )}</span>
          <div class="row-body">
            <p class="card-title">${escapeHTML(
              conversation.at
                ? new Date(conversation.at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : 'Undated',
            )}</p>
            <div class="chips">
              <span class="chip quiet">${conversation.kept} kept</span>
              <span class="chip quiet">${conversation.droppedOther} dropped</span>
              ${conversation.summary ? `<span class="chip">${escapeHTML(String(conversation.summary).slice(0, 40))}</span>` : ''}
            </div>
          </div>
        </div>
      </article>`,
        )
        .join('')
    : empty('No conversation has been read yet.');

  renderOthers();
  renderLedger();
}

/**
 * The counterpart of the drop rule. The app can promise a person their speech
 * was discarded, and it can prove it from the record — so it states the rule and
 * the counts, and says plainly that it has no way to send anything.
 */
function renderOthers() {
  const privacy = state.ledger.privacy || {};
  const trust = state.ledger.trust || {};
  $('#receipts-people').innerHTML = `
    <p class="note">Anyone you spoke with can see what was kept of their words and ask for it to be deleted.</p>
    <div class="proof"><span>Their words, kept</span><b>${trust.othersRetained ?? 0}</b></div>
    <div class="proof"><span>Their utterances dropped before storage</span><b>${privacy.utterancesDroppedOther || 0}</b></div>
    <div class="proof"><span>Receipts sent from this build</span><b>0</b></div>
    <p class="note">No receipt has been sent from this build. Sending one needs an address for the other person, and this app holds no address it did not read from a promise.</p>`;
}

function renderLedger() {
  const ledger = state.ledger;
  const items = ledger.items.filter((item) => item.state !== 'forgotten');
  const filtered = items.filter((item) => state.filter === 'all' || item.decision === state.filter);
  const shown = filtered.slice(0, state.visible);

  $('#ledger-fact').textContent = `${shown.length} of ${items.length}`;
  $('#commitment-list').innerHTML = shown.length
    ? dayGroups(shown, row)
    : empty(state.filter === 'all' ? 'Nothing is in the ledger yet.' : 'Nothing in this category.');

  const more = $('#load-more');
  more.hidden = shown.length >= filtered.length;
  more.textContent = `Show ${Math.min(28, filtered.length - shown.length)} more`;

  $$('#filters .filt').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  });

  const count = ledger.bankruptcy?.count ?? 0;
  $('#bankruptcy-sub').textContent = count
    ? `${count} commitment${count === 1 ? '' : 's'} are obsolete: tiered \u201cleave it\u201d, or retired by you.`
    : 'Nothing is obsolete. No commitment has been tiered \u201cleave it\u201d, and none has been retired by hand.';
  const button = $('#bankruptcy-btn');
  button.disabled = count === 0;
  button.textContent = count ? `Retire ${count} item${count === 1 ? '' : 's'}` : 'Retire nothing';
}

/* ======================================================================== */
/* the receipt sheet                                                        */
/* ======================================================================== */

function distBlock(name, distribution) {
  if (!distribution) {
    return `
      <p class="note">${escapeHTML(name)} has not scored this row, so no distribution is shown. Nothing is filled in on its behalf.</p>
      <div class="dist">${OPTIONS.map(
        (option) => `
        <div class="m">
          <span>${escapeHTML(OPTION_LABEL[option])}</span>
          ${bar(0)}
          <span>—</span>
        </div>`,
      ).join('')}</div>`;
  }
  let top = OPTIONS[0];
  for (const option of OPTIONS) if (distribution[option] > distribution[top]) top = option;
  return `
    <div class="dist">${OPTIONS.map(
      (option) => `
      <div class="m ${option === top ? 'current' : ''}">
        <span>${escapeHTML(OPTION_LABEL[option])}</span>
        ${bar((distribution[option] ?? 0) * 100)}
        <span>${Math.round((distribution[option] ?? 0) * 100)}%</span>
      </div>`,
    ).join('')}</div>
    <p class="note">${escapeHTML(name)}\u2019s top option: ${escapeHTML(OPTION_LABEL[top])} at ${Math.round(
      distribution[top] * 100,
    )}%. ${escapeHTML(OPTION_ACTION[top])}.</p>`;
}

/** The quote mark and the bar strip are ornament, not a claim: this is a mark
    for speech, not a player, and the strip is drawn from the text itself. Heights
    are set by paintWave, because a strict CSP refuses a style attribute. */
function wave(quote) {
  const cells = [];
  for (let index = 0; index < 34; index += 1) {
    const value = 6 + ((quote.codePointAt(index % Math.max(1, quote.length)) || 40) + index * 7) % 20;
    cells.push(`<i data-h="${value}"></i>`);
  }
  return `<div class="wave" aria-hidden="true">${cells.join('')}</div>`;
}

function paintWave(root = document) {
  root.querySelectorAll('.wave i[data-h]').forEach((element) => {
    element.style.height = `${element.dataset.h}px`;
  });
}

function openItem(id, options = {}) {
  const item = state.ledger.items.find((entry) => entry.id === id);
  if (!item) return;
  state.editId = null;
  const open = item.state === 'live' || item.state === 'blocked';

  const actions = open
    ? `<button class="btn btn-pri" type="button" data-act="approve" data-id="${escapeHTML(item.id)}">${
        item.decision === 'ask'
          ? 'Approve and prepare a draft'
          : item.decision === 'draft'
            ? 'Approve and mark it complete'
            : 'Approve and mark it handled'
      }</button>
       <button class="btn" type="button" data-act="edit" data-id="${escapeHTML(item.id)}">Correct the reading</button>
       <button class="btn" type="button" data-act="dismiss" data-id="${escapeHTML(item.id)}">Reject and retire</button>`
    : '<button class="btn full-btn" type="button" data-act="close">Close</button>';

  const span =
    item.origin === 'conversation' && item.spanStart !== null && item.spanStart !== undefined
      ? `Characters ${item.spanStart}\u2013${item.spanEnd} of your retained utterance.`
      : 'Recorded as a Bee todo. Bee owns the original audio; it never reaches this machine.';

  $('#sheet').innerHTML = `
    <div class="sheet-top">
      <span class="chip ${escapeHTML(item.decision)}">${escapeHTML(DECISION_LABEL[item.decision] || 'Unscored')}</span>
      <button class="close" type="button" aria-label="Close" data-act="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>

    <h2 class="sheet-h2" id="sheet-title">${escapeHTML(item.title)}</h2>
    <p class="lbl">${escapeHTML(item.person ? `${item.person} \u00b7 ` : '')}${escapeHTML(item.source)}</p>

    <div class="qy">
      <div class="play">
        <b>${icon('quote')}</b>
        <span>\u201c${escapeHTML(item.quote)}\u201d</span>
      </div>
      ${wave(item.quote)}
      <p class="lbl">${escapeHTML(span)}</p>
    </div>

    <span class="sheet-lbl">What Latent read</span>
    <dl class="sheet-row">
      <dt>Sentence</dt><dd>${escapeHTML(item.title)}</dd>
      <dt>Owner</dt><dd>${escapeHTML(item.owner || 'You')}</dd>
      <dt>Counterparty</dt><dd>${escapeHTML(item.person || 'None named')}</dd>
      <dt>Due</dt><dd>${escapeHTML(item.dueDay || 'No date stated')}</dd>
      <dt>State</dt><dd>${escapeHTML(item.state)}</dd>
      <dt>Tier</dt><dd>${escapeHTML(item.tier || 'Not tiered')}</dd>
      <dt>Stakes</dt><dd>${item.stakes ? escapeHTML(String(item.stakes)) : 'Not scored'}</dd>
    </dl>

    ${
      item.factors
        ? `<span class="sheet-lbl">What moved it</span>
           <div class="qv">${item.factors
             .map(
               ([label, rate, n]) => `
             <div class="fa"><span>${escapeHTML(label)}</span><b>${
               rate === null || rate === undefined
                 ? `Not enough data (n=${n})`
                 : `${percent(rate)} <span class="lbl">n=${n}</span>`
             }</b></div>`,
             )
             .join('')}</div>`
        : ''
    }

    <span class="sheet-lbl">Jev\u2019s read</span>
    ${distBlock('Jev', item.jevDist)}
    <span class="sheet-lbl">d1\u2019s read</span>
    ${distBlock('d1', item.d1Dist)}

    <span class="sheet-lbl">Why this tier</span>
    <div class="qv"><p>${escapeHTML(item.why)}</p></div>
    <div class="qv gap">
      <p><b>${escapeHTML(GATE_TITLE[item.decision] || 'Policy')}.</b> ${escapeHTML(item.policy)}</p>
    </div>

    <span class="sheet-lbl">Outcome</span>
    <p class="note">${escapeHTML(item.result)}</p>

    <div class="btn-row act">${actions}</div>
    <p class="note">Redaction: ${escapeHTML(item.redaction || 'profile-name-match')}. Nothing leaves this machine.</p>
  `;

  showSheet();
  paintBars($('#sheet'));
  paintWave($('#sheet'));
  if (options.focusClip) {
    const clip = $('#sheet .qy');
    if (clip) clip.scrollIntoView({ block: 'center' });
  }
  $('#sheet').querySelector('.close')?.focus();
}

function openEdit(item) {
  state.editId = item.id;
  $('#sheet').innerHTML = `
    <div class="sheet-top">
      <span class="chip quiet">Correct the reading</span>
      <button class="close" type="button" aria-label="Close" data-act="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <h2 class="sheet-h2" id="sheet-title">Correct the reading</h2>
    <p class="note">Change the sentence Latent read, or the due date. The quote is never changed, so the receipt keeps what you actually said.</p>
    <form id="edit-form">
      <div class="field">
        <label for="edit-text">Sentence</label>
        <input type="text" id="edit-text" maxlength="300" value="${escapeHTML(item.title)}" />
        <p class="field-hint">Up to 300 characters.</p>
      </div>
      <div class="field">
        <label for="edit-due">Due date</label>
        <input type="date" id="edit-due" value="${escapeHTML(item.dueDay || '')}" />
        <p class="field-hint">Leave empty when no date was stated.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-pri" type="submit">Save the correction</button>
        <button class="btn" type="button" data-item="${escapeHTML(item.id)}">Cancel</button>
      </div>
    </form>
    <span class="sheet-lbl">Source clip</span>
    <div class="qy"><p>\u201c${escapeHTML(item.quote)}\u201d</p></div>`;
  showSheet();
  $('#sheet').querySelector('#edit-text')?.focus();
}

/**
 * The history button on every hero. It answers one question — what did Bee
 * last send, and when — from the sync receipt the ledger already holds.
 */
function openHistory() {
  const ledger = state.ledger || {};
  const sync = ledger.sync;
  const close = `<button class="close" type="button" aria-label="Close" data-act="close">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
  </button>`;

  $('#sheet').innerHTML = `
    <div class="sheet-top">
      <span class="chip quiet">Bee</span>
      ${close}
    </div>
    <h2 class="sheet-h2" id="sheet-title">What Bee sent</h2>
    ${
      sync
        ? `<div class="receipt">
             <span class="receipt-dot ${escapeHTML(sync.kind || 'ingest')}" aria-hidden="true"></span>
             <div class="receipt-body">
               <h3>${escapeHTML(sync.title || 'Sync')}</h3>
               <p>${escapeHTML(sync.detail || '')}</p>
             </div>
             <time>${escapeHTML(String(sync.at || '').slice(11, 16))}</time>
           </div>`
        : empty('Bee has not been read on this machine yet.')
    }
    <span class="sheet-lbl">The last read</span>
    <dl class="sheet-row">
      <dt>Connected</dt><dd>${ledger.connected ? 'Yes' : 'No'}</dd>
      <dt>Account</dt><dd>${escapeHTML(ledger.owner || 'Unknown')}</dd>
      <dt>Last run</dt><dd>${escapeHTML(ledger.lastRun ? String(ledger.lastRun).replace('T', ' ').slice(0, 19) : 'Never')}</dd>
      <dt>Cursor</dt><dd>${escapeHTML(ledger.cursor || 'None')}</dd>
    </dl>
    <p class="note">${
      ledger.preview
        ? 'Preview mode. Every number on this screen comes from a synthetic ledger, not from Bee.'
        : 'The ingest is the only part of this app that touches the network. It runs here and writes to a local SQLite file.'
    }</p>`;

  showSheet();
  $('#sheet').querySelector('.close')?.focus();
}

function showSheet() {
  const scrim = $('#scrim');
  scrim.classList.add('on');
  document.body.classList.add('locked');
  scrim.scrollTop = 0;
}

function closeSheet() {
  $('#scrim').classList.remove('on');
  document.body.classList.remove('locked');
  state.editId = null;
}

/* ======================================================================== */
/* talking to the server                                                    */
/* ======================================================================== */

let toastTimer;
function notify(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('on'), 2600);
}

function go(screen) {
  const target = $(`#${screen}`);
  if (!target || !target.hidden) return;
  state.tab = screen;
  $$('.view').forEach((view) => {
    view.hidden = view.id !== screen;
  });
  $$('#dock .dock-tab').forEach((button) => {
    const active = button.dataset.tab === screen;
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (screen === 'horizon-screen') renderHorizon();
  window.scrollTo({ top: 0, behavior: 'auto' });
  /* A tab comes in from just below its resting place, by an amount small enough
     that it reads as the page settling rather than as a transition. */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    target.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], {
      duration: 220,
      easing: 'ease-out',
    });
  }
  /* The Twin's canvas is sized from its box, so it has to be told that the box
     has a size again once its screen becomes visible. */
  if (screen === 'twin-screen') window.dispatchEvent(new Event('resize'));
}

async function api(route, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Latent-Token': state.token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

/**
 * A write. In preview mode the ledger is synthetic and the server refuses
 * writes, so the same change is applied to the copy in memory instead. The real
 * database is never touched from the preview.
 */
async function act(route, body, message, options = {}) {
  if (state.ledger?.preview) {
    applyLocally(route, body);
    closeSheet();
    render();
    if (!options.quiet) notify(`${message} (preview, nothing saved)`);
    return { preview: true };
  }
  try {
    const result = await api(route, { method: 'POST', ...(body ? { body } : {}) });
    state.ledger = result.ledger || state.ledger;
    closeSheet();
    render();
    if (window.LatentTwin) window.LatentTwin.reload();
    if (!options.quiet) notify(message);
    return result;
  } catch (error) {
    notify(error.message);
    return null;
  }
}

const POLICY_AFTER = {
  draft: 'Latent will prepare the draft and hold it here. Nothing is sent until you say so.',
  execute: 'Latent will treat it as done once it finds the evidence.',
};

function applyLocally(route, body) {
  const ledger = state.ledger;
  const approve = route.match(/^\/commitments\/([^/]+)\/approve$/);
  const dismiss = route.match(/^\/commitments\/([^/]+)\/dismiss$/);
  const edit = route.match(/^\/commitments\/([^/]+)\/edit$/);
  const stamp = new Date().toISOString();

  const push = (receipt) => {
    ledger.receipts = [{ ...receipt, at: stamp }, ...(ledger.receipts || [])];
  };

  if (approve) {
    const item = ledger.items.find((entry) => entry.id === approve[1]);
    if (!item) return;
    if (item.decision === 'ask') {
      item.tier = 'draft';
      item.decision = 'draft';
      item.policy = POLICY_AFTER.draft;
      push({ kind: 'draft', title: 'Draft prepared', detail: `${item.title} \u00b7 nothing sent`, decision: 'draft' });
    } else {
      item.state = 'done';
      item.result = 'Closed by you, in the app.';
      item.closedBy = { at: stamp, source: 'user' };
      push({ kind: 'execute', title: 'Marked complete', detail: item.title, decision: 'execute' });
    }
  } else if (dismiss) {
    const item = ledger.items.find((entry) => entry.id === dismiss[1]);
    if (!item) return;
    item.state = 'obsolete';
    item.result = 'Retired by you. No action was taken.';
    push({ kind: 'ignore', title: 'Retired', detail: item.title, decision: 'ignore' });
  } else if (route === '/merge-all' || (route === '/merge' && body?.ids)) {
    const groups =
      route === '/merge-all'
        ? (ledger.today?.duplicates || []).map((group) => group.ids.map(String))
        : [body.ids.map(String)];
    let retired = 0;
    for (const ids of groups) {
      const keep = ids[0];
      for (const id of ids) {
        if (id === keep) continue;
        const item = ledger.items.find((entry) => entry.id === id);
        if (!item) continue;
        item.state = 'obsolete';
        item.result = 'Merged. Another copy of this row was kept.';
        item.closedBy = { at: stamp, source: 'merge', into: keep };
        retired += 1;
      }
    }
    if (ledger.today) {
      ledger.today.openCount = ledger.items.filter((entry) => ['live', 'blocked'].includes(entry.state)).length;
      ledger.today.duplicates = [];
      ledger.today.duplicateRows = 0;
    }
    push({
      kind: 'merge',
      title: `Merged ${retired + groups.length} rows`,
      detail: 'Kept one copy of each and retired the rest.',
    });
  } else if (edit && body) {
    const item = ledger.items.find((entry) => entry.id === edit[1]);
    if (!item) return;
    if (body.text) item.title = body.text;
    item.dueDay = body.dueAt || null;
  }

  const live = ledger.items.filter((entry) => entry.state === 'live');
  ledger.stats = {
    ...ledger.stats,
    open: live.length,
    drafts: live.filter((entry) => entry.decision === 'draft').length,
    asks: live.filter((entry) => entry.decision === 'ask').length,
    handled: ledger.items.filter((entry) => entry.state === 'done').length,
    obsolete: ledger.items.filter((entry) => entry.state === 'obsolete').length,
  };
}

function showUndo(entries) {
  state.undo = entries;
  $('#undo-text').textContent = `${entries.length} retired. Undo within 10 seconds.`;
  const bar = $('#undo');
  bar.hidden = false;
  clearTimeout(state.undoTimer);
  state.undoTimer = setTimeout(() => {
    bar.hidden = true;
    state.undo = null;
  }, 10_000);
}

/* ======================================================================== */
/* render                                                                   */
/* ======================================================================== */

function render() {
  if (!state.ledger) return;
  const preview = Boolean(state.ledger.preview);
  $$('.preview-badge').forEach((badge) => {
    badge.hidden = !preview;
  });
  renderToday();
  renderHorizon();
  renderTwin();
  renderRecord();
  renderTrust();
  paintBars();
}

/* ======================================================================== */
/* events                                                                   */
/* ======================================================================== */

$$('#dock .dock-tab').forEach((button) => {
  button.addEventListener('click', () => go(button.dataset.tab));
});

/* One delegated listener for the whole document, so anything rendered later
   works without being bound again. */
document.addEventListener('click', (event) => {
  const target = event.target;

  const tradeButton = target.closest('#trade-btn');
  if (tradeButton) {
    const candidate = horizonDueItems()[0];
    state.horizonTrade = tradeButton.dataset.clearTrade ? null : candidate?.id || null;
    renderHorizon();
    return;
  }

  const tab = target.closest('#dock .dock-tab');
  if (tab) return; // handled above, and it must not fall through

  const action = target.closest('[data-act]');
  if (action) {
    const { act: kind, id } = action.dataset;
    if (kind === 'close') closeSheet();
    if (kind === 'approve') act(`/commitments/${id}/approve`, null, 'Decision recorded');
    if (kind === 'dismiss') act(`/commitments/${id}/dismiss`, null, 'Commitment retired');
    if (kind === 'decide') openItem(id);
    if (kind === 'edit') {
      const item = state.ledger?.items.find((entry) => entry.id === id);
      if (item) openEdit(item);
    }
    return;
  }

  const approve = target.closest('[data-approve]');
  if (approve) {
    act(`/plans/${approve.dataset.approve}/approve`, { actor: approve.dataset.actor }, 'Approval recorded');
    return;
  }
  const dispatch = target.closest('[data-execute]');
  if (dispatch) {
    act(`/plans/${dispatch.dataset.execute}/execute`, null, 'Plan dispatched');
    return;
  }
  const cancel = target.closest('[data-cancel]');
  if (cancel) {
    act(`/plans/${cancel.dataset.cancel}/cancel`, null, 'Plan cancelled');
    return;
  }
  const ics = target.closest('[data-ics]');
  if (ics) {
    window.location.assign(`/api/plans/${ics.dataset.ics}.ics`);
    return;
  }

  const mergeAll = target.closest('[data-merge-all]');
  if (mergeAll) {
    act('/merge-all', null, 'Duplicates merged. The count went down.');
    return;
  }

  const merge = target.closest('[data-merge]');
  if (merge) {
    act('/merge', { ids: merge.dataset.merge.split(',') }, 'Merged. The count went down.');
    return;
  }

  const item = target.closest('[data-item]');
  if (item) {
    openItem(item.dataset.item);
    return;
  }

  const history = target.closest('[data-history]');
  if (history) {
    openHistory();
    return;
  }

  const filt = target.closest('#filters .filt');
  if (filt) {
    state.filter = filt.dataset.filter;
    state.visible = 14;
    renderLedger();
    return;
  }

  const more = target.closest('#load-more');
  if (more) {
    state.visible += 28;
    renderLedger();
    return;
  }

  const bankruptcy = target.closest('#bankruptcy-btn');
  if (bankruptcy) {
    act('/commitments/retire-obsolete', null, 'Obsolete commitments retired').then((result) => {
      if (result?.retired?.length) showUndo(result.retired);
    });
    return;
  }

  const sync = target.closest('#sync-btn');
  if (sync) {
    syncFromBee();
    return;
  }
});

$('#undo-btn').addEventListener('click', async () => {
  const entries = state.undo;
  if (!entries) return;
  clearTimeout(state.undoTimer);
  $('#undo').hidden = true;
  state.undo = null;
  await act('/commitments/restore', { entries }, `${entries.length} restored`);
});

$('#scrim').addEventListener('click', (event) => {
  if (event.target.id === 'scrim') closeSheet();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSheet();
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'edit-form') {
    event.preventDefault();
    const id = state.editId;
    if (!id) return;
    act(`/commitments/${id}/edit`, { text: $('#edit-text').value, dueAt: $('#edit-due').value || null }, 'Correction saved');
    return;
  }
  if (event.target.id === 'plan-form') {
    event.preventDefault();
    propose();
  }
});

function propose() {
  const participants = $('#plan-people')
    .value.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const payload = {
    commitmentId: $('#plan-commitment').value,
    date: $('#plan-date').value,
    participants,
    consent: $('#plan-consent').checked,
  };
  if (state.ledger?.preview) {
    notify('Plans need the real decision pipeline, so preview mode does not propose one.');
    return;
  }
  api('/plans', { method: 'POST', body: payload })
    .then((result) => {
      state.ledger = result.ledger;
      $('#plan-people').value = '';
      $('#plan-consent').checked = false;
      render();
      notify('Plan proposed');
    })
    .catch((error) => notify(error.message));
}

async function syncFromBee() {
  const button = $('#sync-btn');
  const log = $('#sync-log');
  if (state.ledger?.preview) {
    notify('Preview mode reads a synthetic ledger. Run without PREVIEW=1 to sync Bee.');
    return;
  }
  button.disabled = true;
  button.textContent = 'Reading Bee\u2026';
  log.hidden = false;
  log.textContent = 'Running the ingest\u2026';
  try {
    const result = await api('/sync', { method: 'POST' });
    state.ledger = result.ledger;
    log.textContent = result.log.join('\n');
    render();
    if (window.LatentTwin) window.LatentTwin.reload();
    notify('Bee sync finished');
  } catch (error) {
    log.textContent = error.message;
    notify(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Update from Bee';
  }
}

/* ======================================================================== */
/* boot                                                                     */
/* ======================================================================== */

async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the app works without a worker; it is only the offline copy */
    });
  }
  try {
    const session = await (await fetch('/api/session')).json();
    state.token = session.token;
    state.ledger = await api('/ledger');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const dateField = $('#plan-date');
    dateField.value = tomorrow;
    dateField.min = tomorrow;
    render();
  } catch (error) {
    notify(error.message);
  }
}

window.Latent = { openReceipt: (id) => openItem(id) };

boot();
