# Latent — MVP product and implementation spec

Decision draft · 17 October 2026 · based on `Imply - Hackathon Spec.md`

## 1. Product decision

**Latent helps you follow through on commitments made in conversation, with evidence and explicit control over what happens next.**

Build a desktop-first companion to Bee. Ship the hackathon as a local browser UI with a local service, not a browser extension or a second recording app. Package the same interface as a desktop app only after the commitment loop works. Bee supplies context; Latent supplies the decision, review, coordination, and follow-through ledger.

Working name: Latent. Keep Imply as the previous concept name. No name/domain/trademark availability claim. Suggested line: **“Follow through on what you meant.”**

Initial user: a Bee owner handling several personal and work commitments each day, willing to review a small queue. First session succeeds when the user imports a conversation, verifies one commitment against its source, prepares an action, and understands why another candidate was held back.

### How this relates to Bee tasks

Conceptually an extension of the task lifecycle; technically a separate companion using documented interfaces. There is no verified supported way to embed a custom Latent tab inside Bee. Do not pitch an in-app plugin as already available.

Bee remains the source for conversations and optionally linked to-dos. Latent stores additional commitment metadata: ownership, evidence, ambiguity, decision, approval, action attempts, coordination, and completion evidence. A task checkbox cannot express those distinctions.

Default hackathon integration: read selected Bee conversations and to-dos; keep new commitments in Latent. Optional explicit “Link Bee task” or “Add to Bee” writes through the adapter. Never duplicate every extracted commitment into Bee automatically.

| Surface | Decision | Reason |
|---|---|---|
| Local web app + local service | Build first | Fast iteration; works with a local Bee bridge; clear demo surface |
| Packaged desktop app | Next, if validated | Background sync, native notification controls, credential storage, lifecycle management |
| Browser extension | Do not build for MVP | Most commitments originate outside browser pages; extension does not solve the core loop |
| Native mobile app | Defer | Bee already handles capture; mobile adds distribution and background work |
| Native Bee feature | Partnership direction | Requires Bee cooperation; not a dependency for the demo |

A hosted web UI cannot silently reach a user's local Bee setup. Later hosted distribution requires a deliberate auth/data path or installed bridge. Do not put personal Bee credentials in browser storage or a shared demo server.

## 2. Verified research and implications

Checked 17 October 2026. These are documentation/website findings, not account-level integration tests.

- Bee's site already describes suggested to-dos and email/calendar drafting. Its privacy copy says processed audio is deleted. **Implication:** differentiation must go beyond extraction, and transcript receipts must stand alone. [Bee](https://bee.computer/)
- Bee Desktop captures meetings and syncs with the phone, including to-do completion. It is offered for Mac and Windows under Bee Pro. **Implication:** Latent should not rebuild recording or ordinary cross-device task sync. [Desktop](https://bee.computer/desktop)
- Bee provides a CLI, MCP and export workflow; developer setup requires Developer Mode. **Implication:** a developer-focused local MVP is credible; consumer onboarding needs later work. [Getting started](https://docs.bee.computer/docs)
- The API documents conversations, to-do CRUD, change cursors and SSE. The public endpoint is `https://api.developer.bee.amazon.dev`; local `bee proxy` is also documented. Threads are preview/test-user-only. **Implication:** use a read adapter and our own agents; no dependency on Bee's chat execution. Keep any proxy loopback-only. [API](https://docs.bee.computer/docs/api)
- CLI conversation retrieval includes transcripts, with an utterance command and timestamp filtering. Exact response fields, speaker reliability and span resolution need an adapter spike on an authorized sample. [CLI](https://docs.bee.computer/docs/cli)

Unverified: this account's current API access, transcript field schema, rate limits, deletion coverage, webhook availability, app deep links, audio retrieval, production OAuth distribution, and direct third-party execution through Bee. Do not assume any of these.

## 3. Scope and priority

### P0: demo must work end to end

1. Import one selected transcript or explicitly labeled fixture.
2. Extract candidate commitments with source anchors and editable owner/deadline.
3. Apply a deterministic policy choosing ignore, remember, ask, draft or execute-internal.
4. Review a draft next to its receipt. Approve, edit, dismiss or snooze.
5. Execute one **local action**: create a private calendar hold in Latent's sandbox calendar, returning a persistent ID. Offer an ICS export as the portable handoff. Neither means an external invitation was sent.
6. Coordinate a dinner between two isolated fixture personas; both approve the same proposal before the sandbox plan is committed.
7. Show a ledger with open, completed and needs-check-in items, backed by event records.
8. Run a small labeled evaluation and show measured results. Until run, show “Not evaluated”, never invented percentages.

### P1: integrate only after P0 is reliable

Read real Bee data; optionally link a Bee to-do after explicit action. Add one real calendar adapter on a test calendar if credentials and time permit. Then add sent-mail evidence. Drafting text in Latent is P0; creating a Gmail draft is a separate P1 integration. These capabilities must be labeled separately.

### Cut

Automatic email sending, automatic attachments, purchases, bookings, inferred contact lookup, broad inbox access, multi-party coordination, autonomous reminder messages to others, bandit learning, POMDPs, multilingual coverage and a native recorder. No “guaranteed follow-through” or behavioral efficacy claim.

## 4. Core experience and screen contract

Navigation: **Review / Commitments / Plans / Connections**. Receipts are a detail panel, not a fifth destination. The decision model lives behind “Why this next step?” rather than dominating the homepage.

### A. Connections / first run

Start with two choices: “Try sample conversation” and “Use Bee on this computer”. Show what is read and what stays local. Ask the user to choose a conversation/time window rather than ingesting their entire history. Present the model-processing disclosure before sending transcript text to a remote model. Confirm speaker identity if unknown. No extraction when the source is empty or access has expired.

States: disconnected, checking, connected with last successful sync, denied, offline, rate-limited, partial import. A failed sync preserves existing commitments and clearly labels stale evidence. “Pause import” stops future reads; “Delete Latent data” removes local content and invalidates pending approvals. It does not claim to delete Bee's original records.

### B. Review / default home

Header: “A few things worth following through on.” Queue shows concrete commitments, owner, due date or “No date agreed”, and next step. Group as “Ready to review”, “One detail missing”, “Remembered”. Hide ignored items from daily review; show aggregate counts only.

Default selection opens a two-column detail: proposed action on the left, source and reason on the right. At narrower widths stack the source below the action. Do not render an omnipresent chat box. Primary action names its effect: “Save private hold”, “Save draft”, “Confirm owner”. Avoid generic “Approve” when the effect is unclear.

Example: “Send Priya the project deck” → draft editor; recipient and file unresolved → disabled external action. No attachment may be guessed. Example: “We should get dinner sometime” → ask whether to make a plan; no permission to contact the other agent yet.

### C. Receipt

Source name/date, speaker, verbatim supported excerpt, timestamp only when present, source revision, decision rule, missing details, approved action version, resulting object ID and timestamp. “Reason” is a short evidence-based explanation, not hidden chain-of-thought. Show unsupported inferences as unresolved fields.

If Bee provides no audio, no play icon. If a source is deleted, show “Source removed” and invalidate unapproved actions. Keep only non-content audit metadata if the user chooses; do not preserve a supposedly deleted quote in an audit log.

### D. Plans

Two named columns: “Your agent” and “Other agent · simulated”. Show only proposals actually exchanged, with a disclosure panel listing the windows/constraints shared. User authorizes a specific negotiation before any data is shared. Max three rounds; one day expiry. Final approval names exact time, timezone, venue and participants. Proposal edits invalidate both approvals.

### E. Commitments

Compact ledger: title, owner, due date, state, evidence freshness. Filters: open / needs check-in / completed / dismissed. Row opens the same receipt. “No completion evidence yet” is distinct from “You didn't do it”. Allow manual completion and record it as user-reported.

Summary language: “6 accepted · 2 completed · 3 need a check-in · 1 still open.” Chased/reminded is an event, not a mutually exclusive commitment status. Never count one item twice in a status breakdown.

## 5. State model and action semantics

Separate three fields:

- Lifecycle: `candidate → open → completed`, or `dismissed`; reopening is explicit.
- Next action: `none | ask | draft | negotiate | private_hold`.
- Health: `on_track | needs_check_in | unknown`.

An approval is an event, not completion. A prepared email is not a sent email. A scheduled dinner is not an attended dinner. For a commitment explicitly to **schedule** dinner, a confirmed plan can complete it; for **have** dinner, attendance needs confirmation.

Draft edits increase `action_version`; approvals bind to its payload hash and policy version. Immediately before execution, recheck permissions, source revision, recipient/time details and availability. Executions use an idempotency key. On network timeout mark “Outcome unknown” and reconcile provider state before retrying. Never optimistically show “Done” on a failed request.

Snooze hides the review until a chosen time; it does not change the promised deadline. Dismissal records an optional correction reason and suppresses the same source/revision candidate on reimport.

## 6. Decision policy

The original expected-utility idea is useful as a later evaluation model. For the weekend, use explicit gates before scoring. A model's self-reported 0.91 is not a calibrated probability.

Order of operations:

1. Verify wearer ownership or explicit user adoption. Unknown speaker → ask; third-party promise → no action on their behalf.
2. Detect negation, joking, quoted speech, hypotheticals and retractions. Use a full local context window, not one sentence.
3. Require valid source anchors and stable transcript revision. Extraction cannot invent a quote.
4. Apply consent, missing-field and action-risk gates.
5. Rank eligible items for review. Deadline proximity and explicit priority affect ordering, not permission.

| Case | Tier | User-facing reason |
|---|---|---|
| Retracted or clearly not a commitment | Ignore | Not retained as an actionable commitment |
| Vague aspiration with no near-term action | Remember | No date or concrete next step agreed |
| Owner, recipient or essential timing unclear | Ask | One detail is needed before preparing this |
| Clear commitment; externally visible next step | Draft | Ready for your review; nothing sent |
| Explicit opt-in, complete details, internal reversible action | Execute-internal | Private action allowed by your rule |

Default internal automation OFF. Approval can authorize one private hold. External sending remains disabled in P0 regardless of confidence. An internal draft may be automatically prepared but must be labeled “Draft prepared”, never “Sent”.

Optional expected-utility experiment: `U(a) = p*benefit(a) - (1-p)*wrong_cost(a) - interruption_cost(a)`, all on documented fixed scales. Maximize only over gate-eligible actions plus no-op. Tune on training examples; freeze before held-out eval. Display confidence as “Uncalibrated model estimate” in a debug view only. Do not claim calibrated probabilities from 20 conversations or use approval feedback as automatic permission expansion.

Interruption budget: proposed starting default two proactive prompts per day, bundled on opening the app; no background notifications in P0. Pending items remain visible when the budget is reached. Sensitive-context candidates stay local and require review.

## 7. Bee integration and task ownership

Use a `ContextProvider` adapter, with `FixtureProvider` and `BeeProvider` implementations. A first read fetches selected conversation IDs; persist cursor/revision only after the database transaction succeeds. SSE is a wake-up signal; re-fetch canonical records and reconcile changes after reconnect. Never run actions directly from partial utterances. Require a finalized conversation or user-initiated processing of a clearly labeled partial source.

Idempotent extraction key: provider + account + conversation ID + revision + extractor version. Candidate matching uses stable source anchor plus normalized intent; uncertain semantic duplicates are presented for merge, not silently merged. Reprocessing a revision preserves edits and marks changed evidence for review.

Each commitment optionally maps to one `bee_todo_id`. Proposed ownership rules:

- Bee owns its task text and completion checkbox; refresh these into the linked view.
- Latent owns receipts, approvals, action state, health and coordination.
- Latent actions do not overwrite task edits made in Bee.
- User chooses “Mark linked Bee task complete” separately; persist the attempted write/result.
- Completion in Bee is labeled “Completed in Bee”, not independent proof of the underlying event.
- If a Bee task is deleted, remove the link and ask whether to keep the separate Latent commitment.
- If a source conversation is deleted, remove cached source content and stop its pending actions.

Do not claim a bidirectional sync is implemented by showing a toggle. First spike must validate schema, paging, revisions, auth failure, timestamps and deletion behavior. Real data access was not performed in this specification task.

## 8. Technical shape

Proposed stack: React + TypeScript UI, Node/TypeScript local service, SQLite local store, a single structured-output model adapter, deterministic policy module. This is a recommendation, not an existing repository implementation. Keep rendering independent of Bee and connectors so desktop packaging is a later shell decision.

Data path: `selected source → normalize → extract → validate evidence → policy → review → versioned approval → outbox → action adapter → receipt → completion reconciliation`.

The browser calls only Latent's local API. The service owns credentials and model calls. Bind loopback, validate Host/Origin, reject cross-origin state changes, use a session token/CSRF protection and never expose the Bee proxy to the LAN. Treat transcripts and agent messages as data, never instructions that can modify policy or run tools.

Tables (proposed):

- `sources`: account/provider/source_id/revision, permitted excerpt, speaker map, source timestamps, deleted_at.
- `commitments`: id, source_id, owner_id, counterparty_ref, title, due_at nullable, timezone, lifecycle, health, created_at, updated_at.
- `evidence_spans`: commitment_id, utterance_id nullable, quote, start/end nullable, anchor_kind (`utterance|text_offset`), source_revision.
- `decisions`: commitment_id, tier, policy_version, rule_ids, uncertainty flags, human-readable summary.
- `actions`: commitment_id, type, version, payload_json, payload_hash, state, idempotency_key, provider_object_id nullable.
- `approvals`: action_id/version/hash, actor_id, approved_at, expires_at, revoked_at.
- `events`: entity_id, event_type, timestamp, minimal metadata, mode (`live|fixture|sandbox`).
- `negotiations` and `messages`: participant IDs, proposal version/hash, safe payload, sequence, expiry, approvals.
- `links` and `sync_checkpoints`: provider entity mapping and persisted cursor.

Local API contract:

| Route | Behavior |
|---|---|
| `POST /imports` | provider + selected source IDs or fixture ID; returns import job |
| `GET /commitments?filter=` | paginated ledger with freshness |
| `GET /commitments/:id` | detail, receipt and action version |
| `PATCH /commitments/:id` | explicit title/owner/deadline corrections; optimistic version check |
| `POST /actions/:id/approve` | expected version/hash; 409 on stale action |
| `POST /actions/:id/execute` | validates approval, queues idempotent work |
| `POST /commitments/:id/dismiss` | records correction and suppression |
| `POST /negotiations` | authorized participants + disclosure scope |
| `POST /negotiations/:id/approve` | binds to proposal hash; does not bypass other approval |
| `DELETE /local-data` | purge content, pending jobs and local indexes |

Model contract: structured candidates with owner evidence, action, optional counterparty, optional deadline, exact quote anchors, unresolved fields and uncertainty flags. Validate types, quote containment and speaker ownership in code. At most one retry on schema failure, then show a recoverable extraction error. Store model/prompt version and duration; no raw transcript telemetry.

Adapter contract: `prepare`, `validate`, `execute(idempotencyKey)`, `reconcile`, `undo` where actually supported. Report undo failure; deleting a local event cannot retract a message already delivered elsewhere.

## 9. Coordination protocol

P0 uses two explicit sandbox personas with separately scoped calendars and stores. The fixture counterpart is not a real reachable person's agent. Do not call this an interoperable Bee network.

Envelope: `protocol_version, negotiation_id, sender_id, recipient_id, sequence, message_id, type, proposal_version, payload, expires_at`. Types: `PROPOSE, COUNTER, ACCEPT, DECLINE, CANCEL, COMMIT`. Payload shares candidate UTC windows plus displayed timezone, duration and venue constraints; never full calendars, transcript excerpts or private reasons.

Each endpoint authenticates the peer and enforces the negotiation's consent scope. Deduplicate message_id; reject expired/out-of-order versions. An agent's ACCEPT means a slot is feasible, not that its human has consented. COMMIT occurs only after both human approvals for one proposal hash and a fresh availability check. One coordinator creates the canonical plan ID. If an external calendar write succeeds for only one side, show partial completion, retry/reconcile or remove the orphan hold; never claim atomic cross-provider booking.

Failure branches: no overlap → offer user editing; third counter → stop; peer unavailable → keep draft; consent revoked → cancel; slot taken → new proposal requiring new approvals. Declined plans do not trigger repeated outreach.

## 10. Completion and drift

P0 evidence sources: explicit user confirmation and sandbox events. P1: confirmed provider object IDs and permitted sent-mail metadata. No inbox scraping by default.

Start `needs_check_in` only when an explicit deadline has passed and no completion signal exists; the UI says evidence is missing. Without a deadline, proposed default review after seven days, labeled as a suggested check-in rather than an overdue promise. Pause drift checks when evidence sources are stale. Cancellation/dismissal is excluded from completion-rate denominators.

Nightly summary is a view generated on demand in P0. Background schedules are P1. Never contact a counterparty just because a commitment drifted.

## 11. Visual direction — corrected to match Bee

User feedback rejected the initial paper-and-sage editorial direction. The current direction follows the actual Bee Desktop interface references in `assets/bee-reference/bee-desktop.png` and `bee-task-sync.png`.

Use white surfaces, near-black system sans-serif text, a fixed white sidebar with soft gray rounded selection, and compact rounded context rows. The home screen is an agent workspace, not a checklist: a yellow-to-lilac greeting panel establishes Latent's presence and one clear “Send to Latent” action; “What I picked up” shows inferred loose ends; the adjacent Latent read shows evidence, inferred intent, a legible follow-through sequence, and the point where user approval is needed. Evidence appears on warm yellow; boundaries and explanations use pale lilac. Keep “Latent for Bee” as an independent companion identity inspired by Bee, not an official Bee app or copied Bee logo.

The agent should feel proactive and capable without implying that a visual prototype has acted on external accounts. In the UI concept, “Send to Latent” opens a clearly labeled preview plan; progress can show what a future agent would understand and prepare, while a persistent human-control message says that external actions return for approval. Use agent-oriented language and role cues, not a list of boxes to check. Keep existing commitment editing and receipt history in the detail surfaces, not as the home-screen focal point. Remembered items remain quiet until relevant. This describes the interaction and presentation only; the current prototype's handoff is an in-memory visual preview.

Tokens: page `#FAFAFA`, surface `#FFFFFF`, primary ink `#171717`, muted ink `#727272`, borders `#E0E0E0`, selection `#EAEAEA`, evidence `#FFED6C`, explanation `#EEE8FB`, success `#E6F5EB`. Black primary buttons; yellow accents; no forest green, Georgia headings or correspondence-desk metaphor.

Typography: system sans throughout, 32px page greeting, 20px section headings, 14px task titles, 12px metadata. Bee's website uses Antarctica, but the implementation does not assume a license for it. Sidebar 216px; main padding 36px; task rows 15px radius; detail panes 20px; pill-shaped navigation and buttons. Use the checked-in Phosphor icons consistently.

At desktop sizes, pair the picked-up context list with Latent's read and follow-through panel. Below 900px, stack these panels; at 640px and below, collapse the hero art and keep the primary handoff visible above the context list. The sidebar becomes a horizontal scrollable navigation row, including Settings. Keyboard focus uses a visible lilac outline. Color never replaces status text. The previous 390px layout remains the responsive baseline; recheck after visual iterations.

The app itself is the high-fidelity wireframe. A standalone in-memory version is generated from the same source as `Latent - Wireframe.html`. Bee's downloaded photography and screenshots stay on the design reference board, outside the shipped app UI.

## 12. Evaluation and release gates

Build 20 consented or scripted conversations with multiple annotated candidate and non-candidate spans. Include explicit promise, soft social intent, negation, sarcasm, quoted promise, other speaker, changed deadline, cancelled plan, ambiguous contact, duplicate mention, code injection, stale transcript and timezone ambiguity.

Split by conversation, e.g. 12 development / 8 held-out. Do not tune on held-out cases. Report small-sample counts and avoid generalizing. Human labels cover commitment span, owner, required fields, allowed action tier and correct restraint. Compare always-ask, naive act-when-extracted and gated policy on identical inputs, all offline; never run unsafe baselines against live accounts.

Metrics: extraction precision/recall, owner accuracy, source-anchor correctness, prohibited-action count, unnecessary interruption count, policy agreement, draft acceptance/edit rate where measured, latency and model cost. Report “simulation” for modeled completion; only claim user outcome gains after a real comparative pilot. Calibration is deferred until enough independent labeled probabilities exist.

Acceptance gates:

- Every displayed quote resolves to its stored source/revision; missing timestamps are not invented.
- Duplicate imports and repeat clicks create no duplicate actions.
- Wrong speaker, unknown recipient, revoked consent and stale approval never execute.
- Email draft and scheduled event never masquerade as proof of delivery/attendance.
- Both persona approvals are required; changing time invalidates both.
- Offline, 401/403, rate limit, partial failure and unknown outcome each have actionable UI states.
- Source deletion removes retained quote text and blocks queued actions.
- Keyboard navigation works; primary flow is usable at 390px and 1440px.
- Demo can be reset without touching personal Bee data.

## 13. Build order and demo

Planning assumption: 36-hour hackathon build window; adjust for team size and API setup. These are budgets, not delivery guarantees.

0–3h: API/schema spike using one authorized sample, lock fixtures and acceptance cases. If real ingest is blocked, keep fixture mode visible and proceed.
3–10h: SQLite schema, extraction validation, deterministic policy, evidence receipts.
10–18h: review/ledger UI and version-bound approval, sandbox private hold/ICS.
18–25h: isolated counterparty, proposal exchange, two approvals and failure branches.
25–30h: evaluation runner and measured results; optional Bee linkage only if the core is stable.
30–36h: integration/error QA, visual pass, rehearsed demo, reset and offline fallback.

Under-two-minute demo:

- 0–15s: select fixture conversation, clearly labeled; two promises and one retraction.
- 15–35s: deck draft appears; missing file blocks send. Open source receipt. Show retraction caused no action.
- 35–65s: authorize dinner coordination; show two fixture agents exchanging candidate windows.
- 65–85s: approve on both sides, create sandbox private hold, inspect event ID and transcript evidence.
- 85–105s: advance **demo clock**, show missing completion evidence and one user-confirmed item.
- 105–120s: show actual evaluation counts, named limitations and the product proposition.

Before public distribution: verify Bee access/licensing, define safe account onboarding, select model/retention settings, secure credentials, validate deletion and calendar semantics, and test whether users find review useful enough to return. Monetization is not a hackathon dependency. A later paid companion is plausible, but Bee owners already pay for overlapping features; willingness to pay must be tested.

## 14. Changes from the original brief

Preserved the commitment loop, restraint, receipts, coordination and evaluation. Resolved platform choice and task ownership. Replaced audio-dependent receipts with transcript-first evidence. Corrected the idea that emailing a deck is reversible. Replaced blanket bystander-redaction claims with scoped wearer ownership and minimal retention. Separated draft, send, scheduling and completion. Replaced unmeasured calibrated scores/bandit learning with deterministic gates. Removed the structural claim that Bee cannot build social coordination; our advantage must be demonstrated product behavior, not an assumed incumbent limitation.

## Deliverables in this folder

- `Latent - MVP Spec.md`: this implementation brief.
- `Latent - Wireframe.html`: interactive fixture-only design prototype; open directly in a browser.
- `Latent - Design Board.html`: reference graphics, palette and platform recommendation.
- `assets/bee-reference/`: four downloaded public Bee graphics plus source manifest. Reference use only; rights remain with their owners.

The original `Imply - Hackathon Spec.md` is preserved. Prototype interactions are simulations; no Bee, email or calendar writes occur.

## 15. Current implementation handoff

The working app is in `app/`, served at `http://127.0.0.1:4317`. Start with `npm start` inside that directory. `app/README.md` records implementation scope, commands and verification.

Implemented: persistent SQLite state, sample/pasted import, conservative offline extraction, exact excerpt receipts, edits/snooze/dismiss/completion, version-bound draft approvals and text export, two-person sandbox negotiation, local private holds and ICS export, activity, deletion and a read-only Bee CLI bridge.

Not implemented: LLM extraction, background Bee sync, Bee task writes, real email/calendar services, production peer identity/transport, audio receipts, native desktop packaging, or a held-out evaluation. Live Bee account access was not exercised.

Implementation differs from the proposed expansion stack: native JS/Node rather than React/TypeScript, with a transactional SQLite state document rather than normalized tables. This provides a working zero-build-step prototype; the more granular schema remains a growth path.

Verification: 13 automated tests passed; browser-tested draft approval/preparation/persistence and two-approval planning; 20/24 development classification cases matched labels. The evaluation is not a real-world accuracy claim.
