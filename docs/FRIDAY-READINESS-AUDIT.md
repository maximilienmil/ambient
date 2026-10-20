# Friday readiness audit

Audited 20 October 2026 against the working tree, local aggregate data, running
fixture UI, original specs, SCOPE's October 19 override, and later owner comments.
This is an implementation/readiness audit, not a new test run. No model calls,
external sends, calendar writes, or personal-data changes were made.

## Verdict

Useful foundations and a reviewable design prototype exist. The agreed demo is
not yet connected end to end. The critical gap is the path from a new attributed
promise to a capacity comparison, approved message/calendar action, and genuine
result receipts. Calling M1/M2 complete confuses landed code with passed gates.

The recorded deadline in SCOPE is Friday October 23, noon PDT / 3 pm EDT; verify
submission rules in the actual event portal before submission. Target Thursday
submission; Friday is buffer. The full long-term product cannot responsibly be
treated as Friday scope.

## What actually exists

| Area | Evidence / status |
| --- | --- |
| Bee ingestion and local ledger | Implemented CLI adapter, SQLite, incremental ingest, source anchors, redaction paths. Account attribution remains problematic; single-Unknown-speaker assumption must not be pitched as verified owner detection. |
| Real account | Read-only aggregate snapshot: 162 Bee to-dos, 32 flagged complete, 130 open; 421 facts, 248 unconfirmed; 1,040 live commitment rows (not 1,040 verified promises); zero persisted receipts and zero explicit independent outcome labels. |
| Reconcile | Existing changeset proposes 10 duplicate retirements and holds all 248 facts. This is a proposal, not 10 applied changes, and normalized exact text is not semantic task identity. Original 33-retirement and precision gates are unmet. |
| Capacity engine | `app/horizon.mjs` and authenticated read-only compare API compute free intervals, effort allocation, deadline shortfall, and proposed blocks. Coherent launch/presentation fixture includes A/B/C alternatives. No calendar provider or .ics input pipeline supplies it yet. |
| Production Horizon | Still `app/public/app.js`: 160 Bernoulli scenarios from Bee's close-flag ratio and item count. No calendar capacity enters this fan. “Show the trade” picks the first due item. This is not the new goal-dependent comparison. |
| Design prototype | Separate `design/horizon-review` branch has two drafts, original vector atmosphere/grain assets, annotation support, synthetic capacity results, A/B/C, review and illustrated receipt states. v2 uses warm paper/yellow/lilac and system type. Actions are explicitly illustrative. |
| Live trigger | Stream processor, reconnect/catch-up code, fixture event path and UI polling exist. Actual attributed Bee event → new fork and reconnect-under-5s demo are not established. |
| Models | Generic Jev/d1/extract adapter exists. Ignored root `.env` contains d1 configuration; not proof of endpoint reachability. `npm start` does not load that file automatically. Respect owner's instruction: d1 stays wired but idle. Jev/genuine model interpretations not demonstrated. |
| Actions | Local approve/edit/dismiss/merge state and receipts; older plan workflow provides an ICS export. No real message sender or timed external focus holds for the chosen Horizon path. |
| Agent interoperability | Stdio MCP tools over the ledger exist, including reconcile and should-act. New fork/approval/execution contract and installable agent skill still missing. |
| Evaluation | Development rules smoke set is 20/24 (83.3%), not held-out accuracy. Model comparison JSON has no model predictions. Outcome audit sample contains 40 unknown labels. Predictor cannot be evaluated. |

## Corrections to previous reports

1. The design branch did **not delete** the capacity engine. Its merge base is
   `d1a8b0f`; the engine was subsequently added on main in `ceeb315`. Its actual
   branch diff adds five design files. Do not mistake two-tip differences for
   deletions made by that branch.
2. Neither the UI fan nor the new capacity module currently imports the owner's
   .ics files. “Runs on your .ics” was unsupported.
3. Version switching has not been diagnosed. The worker is network-first, not a
   network/cache race. A fresh observed browser session has no controller and
   four 404 font requests. `cache.addAll` includes those missing fonts, preventing
   successful initial install. An old worker remains possible on another
   browser profile, but a cache-name bump alone is not a demonstrated fix.
   Separate origins/ports serve the production app and design review; that is
   another source of seeing different versions. Establish one canonical demo.
4. d1 configuration presence is not a successful model connection, nor proof
   that Splash requires authentication. No endpoint request was made in this
   audit. The adapter requires a key field; that is a separate fact from server
   authentication. No d1 work should be activated yet.
5. A failed/unavailable learned predictor does not validate numerical personal
   completion probabilities. The newer agreed capacity-first direction takes
   precedence over the older fan/percentage spec.

## Specific defects / release risks

- `label.mjs:54`: calendar matching chooses the first event in a seven-day date
  window without matching identity, people or subject. It can falsely label an
  unrelated task complete. Do not enable it as evidence without fixing this.
- `label.mjs:186`: consolidation takes the first result, so a completion-flag
  prior can win over later independent judging. Prior-only results also retain
  a done verdict. Preserve unknown until adequate independent support exists.
- `label.mjs:42`: .ics parsing, later-conversation judging, and location evidence
  are placeholders; provider roles do not include the specified judge role.
- `app/public/sw.js:8`: missing trial fonts are precached; fresh worker install
  fails. Remove unavailable font dependencies and use distributable type before
  packaging. Existing trial license is personal-use-only.
- SCOPE and video script still contain obsolete direction: midnight canvas,
  60/40 weighting, Today/Record/Twin and calibrated-looking fan language.
  Reconcile with latest warm Bee/Oura direction, Horizon/Grow/Reconcile, and
  fork/action emphasis. Do not discard useful historical evidence rules.
- No root product README or own project license found. Existing app README and
  video script do not describe the final agreed story. No final Devpost copy,
  cover, proof page, or recorded video found.

## Requirements from follow-up comments still missing

| Owner requirement | Remaining work |
| --- | --- |
| Impressive, standalone, natural Bee extension | Finish selected visual direction in production. Reduce prose, enlarge meaningful graphics; preserve Bee readability and Oura/Gentler hierarchy. Use original/licensed assets and restrained glass controls. |
| Tabs visibly different | Horizon = temporal fork instrument; Grow = editable evidence-supported goals/patterns; Reconcile = finite set of old commitments resolving with evidence. Current production has Horizon/Today/Reconcile; prototype navigation does not constitute three finished experiences. |
| Compare A/B, C available | Bind UI choices to shared comparison API, display actual consequence and Friday-goal-based recommendation. No invented model confidence. |
| Protect launch executes | Prepare exact recipient/message plus timed holds; version-bound approval, one executor, idempotency, partial failure/unknown outcomes, real result IDs. Sending request does not mean recipient agreed. |
| Grow / digital twin / year at a glance | Persist editable goals and correctable pattern interpretations, link dated evidence, connect to planning. Month estimates and year history need distinct representations and honest data sufficiency. Current illustrative year cells are not findings. |
| Proactive / low effort completion | One relevant intervention triggered by context; bounded action suitability assessment and action queue. Reliable useful background run remains absent. |
| Reconcile same task / resolved work | Semantic identity and later dated evidence beyond exact-text duplicates, never age-only closure; feed remaining work into Horizon. |
| Voice ownership | Distinguish self commitment from someone else's request using supplied attribution. For this account, use labeled captured replay when live owner attribution is unresolved. |
| Jev / System One | Real decision evidence and interpretation path still absent. d1 remains idle by latest instruction; do not silently substitute Swift results as evaluated d1/Jev results. |
| Figma / Agentation | No delivered editable Figma prototype or integrated annotation tool verified. HTML review notes exist. Do not claim a Figma artifact was created. |
| Goodlinks / TimesFM | No final traceable goodlinks synthesis or implemented TimesFM integration verified in these artifacts. Treat TimesFM as research/stretch; it is unnecessary for calendar arithmetic and should not imply LLM multiverse prediction. |
| Desktop and mobile | Desktop-first final rebuild plus usable small-screen review/action flow still needed. Native Swift/iOS is deferred, consistent with agreed web-first scope. |

## Critical path to Thursday submission

**Tuesday:** conclude focused visual research; pin one demo entry/version; select
the warm visual direction; build the real Horizon comparison over the existing
engine with the coherent fixture. Replace the probability hero. Keep A/B central,
C secondary. Wire a real event contract and labeled replay fallback.

**Wednesday:** implement and rehearse review → approved message + focus holds →
actual receipts on a dedicated demo account. Handle partial success/retry.
Connect a short Reconcile evidence beat and small usable Grow view. Verify
desktop/mobile, cold start, replay, action failures and no duplicate execution.
Freeze features Wednesday night. If a connector is unavailable, show preparation
honestly and document the gap; do not animate a fictional success as live.

**Thursday:** update README/spec/script, license, reproducible setup, measured
proof page, 3–5 screenshots and cover; record video and submit. Show unsupported
evaluations as unavailable. Keep real account details out of public artifacts.

**Do not spend Friday scope on:** native iOS, TimesFM integration, calibrated
personal probabilities without labels, a full year forecast, another task-list
app, or multi-agent negotiation. These do not unblock the agreed demo.

## Research state

Earlier research cataloged 117 visible Finds including 104 Motion examples,
with deeper creator/component notes on the design branch. This was broad
discovery, not proof of exhaustive whole-library inspection. A Luna subagent is
continuing the collection endpoints and overlooked primary interactive work,
with coverage and limitations recorded separately. Research should inform the
next coherent build rather than multiply standalone design drafts.
