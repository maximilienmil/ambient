# SCOPE — Latent for the Bee Hackathon

**Deadline: Friday Oct 23, 2026, 12:00 pm PDT.** Today is Sunday Oct 18, 2026.
Schedule: M1 Sun night → M2 Mon → M2.5 Mon → M3 Tue → M4 Wed (feature freeze
Wed night) → video Thu → submit Thu night. Friday is buffer only — nothing is
planned there.

The product spine, one sentence: **Bee remembers your past. Latent simulates
your future — and checks Bee's own record against outside evidence.**

## The product (settled decisions)

- **Horizon is the hero** (~60% of the demo). Reconcile is the trust beat
  (~40%). Three screens total: Horizon, Reconcile, Today.
- **The Horizon** (rebuild the existing prototype in the app's React/esbuild
  stack, one data layer, one tokens file; prototype stays as the visual
  reference):
  - Left of "Today": the past as quiet beads (conversations).
  - Arcs: every spoken promise is a thread from the moment it was said to the
    day it is due.
  - Right of "Today": 160 simulated weeks as a fan with a shaded band; the
    heaviest day glows.
  - Big number: chance this week goes clean.
  - "Say a promise": a new arc draws, the fan shifts, the number drops.
  - "Show the trade": highlight the one promise whose removal helps most.
  - One question a day, never a list.
  - Apple design language, simplified technical English everywhere.
- **Reconcile** audits two piles with the same evidence engine:
  - **130 open to-dos** (real count, verified; the "504" figure is stale).
    Pass bar: retire ≥33 (25%) with ≥27/30 precision on a random audit.
  - **248 unconfirmed facts** (real count, verified). Same engine: propose
    confirm/retire with evidence. No separate hard bar, but it is the "Bee
    gets more useful without the user combing through it" story.
- **Out of scope (do not build):** record tab, agent-to-agent negotiation,
  reflective journaling as a user feature, Wrapped as a separate tab (the
  Wrapped card is a deliverable below — a card, not a tab), native iOS,
  Android, anything recording other people.

## Labeling and evidence rules (settled)

The product asks users for **zero labeling**. Outcomes are decided
automatically. The only human step is a one-time audit by the owner, which is
never part of the product.

Automatic outcome labels, in trust order:

1. **Bee completion flag.** Verified: 32/162 to-dos are `completed: true`; the
   payload has **no completion timestamp**. Therefore the flag is a verdict
   only when a later-conversation or calendar item independently supports it;
   otherwise it is a prior, never sole evidence.
2. **Calendar (.ics).** The export exists: 1,093 personal events + 1,251
   family events, full-year coverage. A promised meeting matching an event
   after the promise = done. Parse the ics files (all four, skip the empty
   Assignments one; ignore pre-2025 and post-2026 events).
3. **Later conversations.** `bee search --neural --since <promise> --until <promise + window>` → an LLM judge gives verdict (done / not done / unknown)
   plus the exact quoted support line.
4. **Location visits.** `bee locations recent --from --to`, only if the API
   returns data for the relevant dates.

Every label stores: source, verdict, confidence, evidence pointer. "Unknown"
stays unknown, is excluded from training and testing, and is reported as a
count.

**Anti-cheating rules:**
- The evidence judge sees only material dated after the promise.
- The predictor uses only material dated before the promise.
- Extraction keeps the existing `extract` role. The evidence judge gets a new
  provider role `judge` (see `app/decide/provider.mjs` — add `'judge'` to
  ROLES; it can point at a different base URL/model via env).
- No LLM inside the predictor.

**Product feedback (the only user input, optional):** one-tap Approve / Edit /
Reject on proposed changes, plus ≤3 end-of-day reflection questions about
items the system is unsure of. These feed the model later; never required.

## The predictor (pre-committed, no debate later)

Simple logistic regression, features: phrase type, deadline specificity
(resolved by the deterministic resolver, Q4b: extraction records the phrase; a
unit-tested resolver normalizes "by Friday"-style phrases against the
conversation timestamp; specificity class = none / relative / absolute /
weekday), time of day, week busyness (from the .ics files, fallback: daily
summary density), same-day promise count. **No audience-history feature**
(redaction makes it unreliable).

Time split: train on older months, test on newer. Never mix.

Passes only if BOTH:
1. Brier score lower than the baseline (baseline = overall completion rate
   predicted for every item).
2. AUC ≥ 0.6.
And at least **40 labeled test items** — fewer means "cannot evaluate" and
counts as a fail. **No rescue window. If it fails, cut it the same day and
ship Forecast on base rates + capacity, reporting the honest result.**

## Milestones and acceptance tests

Rules for the agent: stop and report when a checkpoint fails; never build on a
failed one. One commit per milestone with a note: what passed, what is fake,
what is next. No real data in git; fixture mode is the default. No new feature
until the current milestone's test passes.

### M1 — tonight: data + labels + baseline (commit `m1`)

1. `bee sync --full` completes into `app/data/` (gitignored).
2. Ingest is idempotent: running ingest twice yields an identical ledger.
3. Every commitment stores source quote, position, and timestamp.
4. Automatic labeling pipeline produces ≥100 labeled commitments from sources
   1–4 (unknowns excluded and counted). Ship the audit sample file
   `app/audit-sample.json` (40 random auto-labeled items) for the owner's
   one-time check.
5. Time-split script prints the baseline Brier score.
6. A test proves non-wearer speech is removed before storage.
7. Fixture mode: `app/fixtures/` holds synthetic data; a fixture ingest
   produces the same schema.

### M2 — Monday: Reconcile + live moment (commit `m2`)

1. Reconcile runs on the real 130 open to-dos and the 248 unconfirmed facts.
2. Changeset `changeset.json`: each op has type, target id, reason, receipt,
   confidence, reversible flag. Never applied by default.
3. Pass bars: ≥33 to-dos retired at ≥27/30 audit precision on a random 30;
   the 248 facts each get a proposal with evidence.
4. **M2.5 live moment:** consume `bee stream` and show a new promise scored
   with a tier on the Horizon within ~5s. Acceptance test: kill the stream
   mid-promise, reconnect, the missed item still appears within 5s. The same
   screen code path reads from a fixture file in demo mode (that is the
   backup take and the CI path).
5. Wire the audit results file once the owner returns the 40-item check.

### M3 — Tuesday: Horizon + forecast (commit `m3`)

1. Horizon rebuilt in-stack per the spec above, on real Bee data.
2. Monte Carlo: 160 simulated weeks; probabilities in [0,1]; property test —
   more calendar load never raises P(clean week).
3. The number changes when a promise is added or dropped; "Show the trade"
   highlights the single best drop.
4. Predictor eval runs with the pre-committed rule; result written to
   `app/evaluation-results.json`-style output, pass or honest fail.
5. Morning card + overnight agent scheduled run (deliverable 7) wired and
   demonstrated once.

### M4 — Wednesday (feature freeze Wed night): packaging (commit `m4`)

1. Morning card from a real overnight run; overnight agent has run ≥2×.
2. Wrapped card generated from measured numbers only (deliverable 4).
3. MCP server tools: reconcile, slip risk, should-I-act (deliverable 9), one
   command install, own license.
4. Proof page: retired count with audit accuracy, forecast-vs-reality chart,
   model comparison table (Jev / d1 / both / plain AI baseline), tests
   passing — readable in 30 seconds (deliverable 10).
5. `make demo` / `npm run demo` works with no Bee connected (fixture mode).
6. README as product page: architecture diagram, the funnel, screenshots or
   GIF, 5-command setup, real-vs-simulated table, privacy section (redaction,
   local-first, what is never stored).
7. Demo video script + shot list; Devpost text; product feedback; friction
   log; resume bullets from measured numbers; 3–5 screenshots + cover image.

### Stretch (only if M2 passes by Tuesday morning; 3-hour cap)

`latent apply` on ≤10 allowlisted reversible items, snapshot first, undo log,
idempotency (apply twice changes nothing). If not working by Tuesday
afternoon, drop for good.

## The video arc (settled)

60% Horizon / 40% Reconcile weight.

- 0:00 Past as beads, waveform. "130 open loops, 8 months old."
- 0:20 "While you slept" morning card.
- 0:40 Reconcile: the pile collapses, every retirement carries a reason and
  evidence. Facts beat: 248 unconfirmed facts proposed with evidence.
- 1:10 Live: say a promise — arc draws, fan shifts, number drops.
- 2:10 Show the trade.
- 2:30 Eval chart: forecast vs reality. If the predictor was cut, the chart
  says so on screen — the honest result is part of the pitch.
- 2:50 "Bee remembers everything. Latent knows what matters."

Fixture footage is labeled on screen as fixture. Audit/labeling never appears.

## Owner tasks (not the agent's)

- Tonight: `.ics` export — **done** (four files delivered; parser ignores the
  empty Assignments calendar).
- Tomorrow: the one-time 40-item audit (~30 min).
- Answer why to-dos stopped in March (for the demo Q&A).
- Thursday: record the video, submit. Devpost registration, GitHub repo
  checks, MIT license, reviewers, video logistics (quiet voiceover, no
  copyrighted music), optional AWS Bedrock entry only if access is quick.

## Known limitations to state honestly (README + video)

- Completion flags carry no timestamp, so "done" verdicts lean on supporting
  evidence; the flag alone is a prior.
- Open to-dos stop in March 2026 — expect the question.
- Conversation coverage is lumpy (Dec 2025: 3, May: 8, Jul: 5); the
  predictor's thin test months are a stated risk, handled by the ≥40-item
  rule.
