# Latent

Your own Bee conversations, kept as a ledger of commitments you can decide on.

Ingest reads the real Bee account through the Bee CLI into local SQLite: the
wearer's own utterances verbatim, bystander speech dropped before storage. The
app then shows the ledger four ways — as a field you can scrub through the day,
as a feed of one-line rows, as a receipt for every decision, and as the two-sided
plan exchange — and gives you one action that retires everything the pipeline has
marked obsolete, with ten seconds to undo it.

## Run

Requires Node 22.13 or newer.

```bash
cd app
npm ci                       # runtime deps + the UI bundler
npm run build                # bundles ui/twin.jsx -> public/twin.js
npm start                    # http://127.0.0.1:4317
```

`npm run ingest` first, or the ledger is empty. `PORT=4318 npm start` picks
another port; `LATENT_DATA_DIR=/absolute/path` picks another data directory.
SQLite lives at `data/latent.sqlite` (mode 600, excluded from version control)
and is not encrypted by the app. The server binds to loopback only, requires a
per-run session token on every `/api` call, and rejects cross-origin and
cross-site requests.

```bash
npm test                     # 55 tests
npm run ingest               # incremental: only what changed since the last run
npm run ingest -- --full     # backfill from the top (cap with --conversations N)
npm run ingest -- --strict   # fail closed: no attribution assumption (see below)
npm run labels:export        # 30 random commitments -> labels.json for hand-labelling
npm run decide               # score the unscored rows (needs model endpoints)
npm run eval                 # offline comparison table, no keys needed
npm run icons                # regenerate the PWA icons
```

## The five screens

One typeface, tabular numerals throughout, four type steps (34 / 20 / 16 / 13),
body copy never below 16px, every control at least 44x44, and `tokens.css` is the
only place a colour, font, radius or spacing value is defined.

### Twin

The top 55% of the viewport is the field; below it a draggable sheet holding one
**Now** item (a single next action, its confidence, and a button that opens the
source clip) followed by the day's feed.

A React component (`ui/twin.jsx`) drawing on Canvas 2D, laid out by `d3-force`.
No WebGL, no glow, no bloom, no particles.

| Channel | Means |
| --- | --- |
| Position | days the commitment has been open |
| Size | stakes, when the decision layer scored them; a fixed size until then |
| Ring | the current tier, in that tier's colour — the only tier colour on the canvas |
| Opacity | confidence `p`; unscored rows at a stated 40% |
| Two arcs | Jev (solid) and d1 (dashed), each spanning that model's probability for the chosen tier. Overlapping arcs are agreement; split arcs are not. |
| Dashed ring | your four-week norm for open load |

Edges join commitments sharing a person or a conversation. Only short ones are
drawn — a line across the whole field carries no readable relationship and, at 500
nodes, buries the field. The relationship is still on every row either way.

Motion runs 150–600ms ease-out and is disabled under `prefers-reduced-motion`.
Tapping a node opens its receipt sheet. A day scrubber at the bottom replays the
day: rows that had not happened yet at that hour are held back, with the count
shown. Floors and ceilings are all real: 500 nodes, 345 edges.

**Frame cost.** `window.__twinBench(n)` runs `tick + draw` directly, so a
background tab cannot throttle the reading into meaninglessness. At 500 nodes and
345 links it reports a median of 0.8ms and a p95 of 1.0ms per frame, with 120/120
frames inside a 16.7ms budget. That is a measurement on the machine that ran it,
not an iPhone measurement, and it is not presented as one.

**The four-week norm** is a rolling sample of open load in
`data/load-history.json`, one sample per calendar day. Until there are seven
earlier days it is provisional and equals today's load; the legend says exactly
that rather than dressing up a first day as a baseline. Nodes outside the dashed
ring mean more open than usual.

### Feed

One row per commitment: a tier dot, a plain sentence ("Held back." / "Draft
ready." / "Closed." / "Remembered." / "Retired." / "Not scored."), the
commitment sentence, confidence as a five-segment bar plus the number, "Needs
you." when the row is waiting on you, and a right-aligned timestamp. A closed row
also says how it closed — confirmed by you, or marked complete in Bee.

An unscored row reads "No score" with empty segments. Nothing is filled in on the
pipeline's behalf.

### Receipt sheet

Opened from a Twin node, a Now item, or any feed row. It holds the transcript clip
with its character span, the extracted fields, **both** model distributions as two
five-bar charts (each marking that model's own top option), the reason for the
tier, the policy that applied, the receipt, and three actions: approve, edit the
extraction, or reject. Edit corrects the sentence or the due date and never
touches the source quote.

There is no audio playback anywhere in the app: the Bee CLI exposes transcript
text, not audio, so the clip is the text span itself. Nothing pretends otherwise.

### Negotiation

A vertical timeline per plan. The second agent is labelled **simulated** on every
one of its lines, because both sides of the exchange are recorded on this device:
no message is sent and nobody is notified. Each event lists what that side put on
the table and what it withheld, and a plan still needs consent, two distinct
names, a future date, and two approvals before a calendar file is written.

### Bankruptcy action

One button in the Feed retiring every item the ledger treats as ignore — tiered
`ignore` by the pipeline, or retired by hand — with the real count on it and ten
seconds to undo. When the count is zero the button is disabled and says so. The
undo restores each row to the state it actually had.

## API

Everything below is loopback-only and requires the session token from
`GET /api/session`.

| Route | Does |
| --- | --- |
| `GET /api/session` | per-run token |
| `GET /api/ledger` | the whole read model: items, plans, receipts, stats, privacy, norms, negotiation, bankruptcy count |
| `POST /api/commitments/:id/approve` | record the decision (an `ask` becomes a draft; a `draft` closes) |
| `POST /api/commitments/:id/dismiss` | retire a row |
| `POST /api/commitments/:id/edit` | correct the extracted sentence or due date |
| `POST /api/commitments/retire-obsolete` | the bankruptcy action, returns what it retired |
| `POST /api/commitments/restore` | the ten-second undo |
| `POST /api/plans` · `/approve` · `/execute` · `/cancel` · `GET /:id.ics` | the plan exchange and the calendar file |
| `POST /api/sync` | run the ingest and return its log |

`commitments` holds exactly the requested columns: `id, text, quote, owner,
counterparty, source_conversation_id, span_start, span_end, created_at, due_at,
state, tier, p, jev_scores, d1_scores, evidence, closed_by`. `span_start` /
`span_end` are character offsets of `quote` inside the retained utterance, so a
receipt can point at the exact words. `state` is one of
`live | done | obsolete | blocked | forgotten`. `tier` is NULL until the decision
layer scores a row, and `p`, `jev_scores`, `d1_scores` stay empty until then — the
ingest never invents a probability. Stakes, once scored, live inside the
`evidence` JSON. Two-store rule: ingest only ever writes what Bee said; `plans`
and `receipts` hold your decisions and are never rewritten by a sync.

## The decision pipeline (`/decide`)

JSON only, schema-validated, models never see raw conversation text.

1. **Extraction** (`extract.mjs`) — one transcript span into the structured
   commitment fields. Injection phrases are rejected before the call.
2. **Evidence** (`evidence.mjs`) — quote, speaker, addressee, deadline wording,
   done signals. This block is the *only* thing a model sees.
3. **Scoring** (`score.mjs`) — Jev and d1 independently, both over the declared
   options `[ignore, remember, ask, draft, execute]`, each returning a five-way
   distribution. They are allowed to disagree.
4. **Policy** (`policy.mjs`) — agreement plus a top probability above the
   threshold acts at that tier; disagreement or low confidence asks; `execute`
   only when the action is reversible and internal, `draft` for anything
   external.
5. **Calibration** (`calibrate.mjs`) — temperature scaling and tie-aware isotonic
   regression fitted on `labels.json`, with the error before and after.
6. **Eval** (`eval.mjs`) — Jev alone, d1 alone, both together, and an LLM-only
   baseline: accuracy, wrong-action rate, calibration error, latency, cost per
   decision.

Each role is one OpenAI-compatible chat-completions endpoint, configured by env
var and nothing else:

```
JEV_BASE_URL      JEV_API_KEY      JEV_MODEL      [JEV_PRICE_IN] [JEV_PRICE_OUT]
D1_BASE_URL       D1_API_KEY       D1_MODEL       [D1_PRICE_IN]  [D1_PRICE_OUT]
EXTRACT_BASE_URL  EXTRACT_API_KEY  EXTRACT_MODEL  [EXTRACT_PRICE_IN] [EXTRACT_PRICE_OUT]
```

Prices are USD per million tokens; cost is reported as `null` unless both prices
for a role are set. `DECIDE_TIMEOUT_MS` (default 30000) bounds each call. **No
keys are set on this machine**, so `npm run decide` prints
`not configured: jev — missing JEV_BASE_URL, JEV_API_KEY, JEV_MODEL` and writes
nothing, and every unscored row says "No score" in the UI. A fabricated number
would be worse than an empty one.

`labels.json` is currently unlabelled, so calibration correctly reports
`no labelled rows`. The data is in `decide/eval-results.json`.

## Bee calls

The ingest reaches Bee only through the documented CLI, which is the supported
client for the same `/v1/*` data (`https://docs.bee.computer/docs/api`). No write
calls, no guessed endpoints.

| Command the code runs | Reads | Docs |
| --- | --- | --- |
| `bee me --json` | `GET /v1/me` — owner name, id, timezone | [CLI · bee me](https://docs.bee.computer/docs/cli#bee-me) |
| `bee changed [--cursor <c>] --json` | `GET /v1/changes` — changed ids + `meta.next_cursor` | [Agentic Sync](https://docs.bee.computer/docs/agentic-sync) |
| `bee conversations list --limit N [--cursor <c>] --json` | `GET /v1/conversations` — summaries + `next_cursor` | [CLI · conversations list](https://docs.bee.computer/docs/cli#bee-conversations-list) |
| `bee conversations get <id> --json` | `GET /v1/conversations/:id` — transcriptions → utterances | [CLI · conversations get](https://docs.bee.computer/docs/cli#bee-conversations-get) |
| `bee todos list --limit N [--cursor <c>] --json` | `GET /v1/todos` | [CLI · todos list](https://docs.bee.computer/docs/cli#bee-todos-list) |
| `bee todos get <id> --json` | `GET /v1/todos/:id` | [CLI · todos get](https://docs.bee.computer/docs/cli#bee-todos-get) |
| `bee facts list --limit N [--cursor <c>] --json` | `GET /v1/facts` | [CLI · facts list](https://docs.bee.computer/docs/cli#bee-facts-list) |
| `bee facts get <id> --json` | `GET /v1/facts/:id` | [CLI · facts get](https://docs.bee.computer/docs/cli#bee-facts-get) |

Field names were not guessed. They were captured from an authenticated
`@beeai/cli 0.6.0` run and are recorded in `bee.mjs`:

- `bee me` → `{ id, first_name, last_name, timezone }`
- `bee conversations list` → `{ conversations: [{ id, start_time, end_time, device_type, summary, short_summary, state, created_at, updated_at, utterances_count, primary_location }], next_cursor, timezone }`
- `bee conversations get <id>` → `{ conversation: { …, transcriptions: [{ id, realtime, utterances: [{ id, realtime, start, end, spoken_at, text, speaker, created_at }] }] }, timezone }`
- `bee facts list` → `{ facts: [{ id, text, tags, created_at, confirmed }], next_cursor, timezone }`
- `bee todos list` → `{ todos: [{ id, text, alarm_at, completed, created_at, corrections }], next_cursor, timezone }`
- `bee changed` → `{ meta: { next_cursor, since, until, updated, timezone }, facts, todos, dailies, conversations, journals }`

Documented commands this CLI build does not expose are deliberately unused:
`bee conversations transcript <id>` and `bee todos suggestions` return
`Unknown … subcommand` on 0.6.0. `bee changed` is used only to discover changed
ids; each entity is then re-read through its own documented `list`/`get`
endpoint. `bee changed` rejects a cursor older than the server's retention window
with `cursor_too_old`; the ingest then restarts the window without a cursor and
says so.

**Redaction.** Only the wearer's own utterances are stored, verbatim. Bystander
speech is dropped before storage and reported as a count; bystander text never
reaches SQLite (a test scans every table for a planted marker). Attribution comes
from the Bee profile name plus `LATENT_OWNER_LABELS`, falling back to
`You`/`Me`/`Owner`. When Bee reports a single speaker label for a whole
conversation and none matches the wearer's name, the ingest attributes that one
voice to the wearer and records `assumed-single-speaker` on every affected row and
in the run log; `--strict` refuses that assumption instead. On the live account
read here, Bee reported one label (`Unknown`) on all 30 conversations, so
attribution is `assumed-single-speaker` on every row and 0 bystander utterances
were dropped. That is a real limitation of the source data, and the receipts say
so rather than implying speaker separation that Bee did not provide.

## PWA

`manifest.webmanifest`, real PNG icons generated by `make-icons.mjs`, a service
worker that caches the shell and **never** caches `/api` (the ledger must not go
stale behind your back), safe-area insets on every edge, and
`viewport-fit=cover`. Add to home screen from Safari or Chrome for a standalone
window.

## Verification

```bash
npm test        # 55 tests, 0 failures
npm run eval    # offline table
```

Coverage includes wearer attribution and strict mode, bystander redaction across
every table, extraction rules and character spans, the exact `commitments`
schema, idempotent re-ingest, cursor handling, the decision mapping, plan consent
and two-party approval, calendar export escaping, the bankruptcy action with its
undo, the correction path, distribution parsing, the ingest receipt merge, and
true zeros on an empty database (no placeholders). The decision pipeline adds its
own suite for schema validation, prompt-injection refusal, policy outcomes,
calibration, and the eval table.

### UI audit

Every screen was measured at **390x844** and **1920x1080** — DOM geometry,
computed contrast, and frame cost — not eyeballed. Fixes applied:

| Found | Fixed |
| --- | --- |
| Scrubber panel covered the legend text | Legend moved into the sheet under "How to read the field"; scrubber given its own strip below the canvas so it can never sit on the nodes |
| Tier tag text at 3.25:1, receipt timestamps at 3.26:1 | All six tier tones and `--muted-3` darkened; every tier tone now ≥4.6:1 on its own soft background, tag probes 4.65–5.73:1 |
| Form inputs 25px tall, checkbox row 36px | Inputs, selects and the consent row all 44px |
| 345 edges crossing the whole field buried the nodes | Only edges short enough to read are drawn (298 of 345); the rest are still recorded on the row |
| Twin stage fell back to a 360px floor instead of 55% | `--main-h` computed explicitly, desktop frame included; stage is exactly 55% at both widths |
| `Retire nothing` still looked actionable when the count was zero | Disabled with honest copy |
| Bee label rendered as a stray pill inside the paragraph | A plain provenance line: "Bee account · Maximilian Milovidov" |

Known and deliberate: the metadata lane is 13px (the fourth step of the stated
scale) and nothing renders below it; the consent checkbox box is 20px inside a
44px row, because the label is the hit area.

Not verified here: the live vendor calls in `/decide` (no keys on this machine),
so the scoring path has only been exercised through injected clients and fixtures,
and the frame cost was measured on a desktop, not an iPhone.

## Boundaries

A functioning local MVP, not the complete production spec. Extraction is
regex-based and limited to one `Speaker: utterance` per line — idioms, negation
scope, multilingual speech, identity ambiguity and multi-line context remain
unreliable. A draft is review material, never an autonomous external action.
Relative dates are flagged for manual confirmation instead of being guessed.

No background sync, no Bee writes, no audio clips (Bee exposes text, not audio),
no real email or calendar connector, no remote agent network, and no production
account management. The negotiation counterparty is a simulation on this device,
labelled as one on every line it appears on. The server is local-only and must not
be exposed publicly.

`domain.mjs` and `evaluate.mjs` remain as the offline rule engine and the old
evaluation baseline; `domain.test.mjs` still covers them.

Icons: Phosphor, MIT; see `public/icons/LICENSE`. Bee reference assets are research
material outside the app, not redistributed inside the product UI.
