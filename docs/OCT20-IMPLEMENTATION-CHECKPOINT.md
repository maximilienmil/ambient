# October 20 implementation checkpoint

## Delivered

- Canonical production workspace: capacity-first Horizon, persistent editable
  Grow, and evidence-first Reconcile. Earlier UI and mobile prototype preserved.
- Grow stores stated goals and correctable interpretations with source
  provenance, versions, pause/reject states, remaining effort and deadlines.
  Supported repeated-topic suggestions link to actual Bee task records; they
  are not claims about the owner's hidden motivations.
- Shared capacity comparison powers the UI. A/B and smaller-release option use
  the same calendar arithmetic. Assumptions are editable; Month/Year display
  observations rather than invented behavior forecasts.
- Recovered the original calendar ZIP from this thread: four local files,
  2,338 source VEVENTs; 589 occurrences in the bounded 2025–2026 import window,
  zero unresolved floating timestamps. Original private calendars stay ignored.
- Corrected date-only evidence matching and completion-prior handling. Optional
  judge adapter enforces later owner-attributed source IDs and verbatim support;
  it requires explicit enablement and configured judge endpoint. d1 stays idle.
- Approval/execution API: immutable payload hash, explicit review/approval,
  per-step durable receipts, concurrency protection, and no automatic retry on
  uncertain provider outcomes. Google adapter uses authenticated `gog`; local
  sandbox holds/messages are distinguished from external writes and sends.
- Persistent action history survives reload. Legacy service-worker shell cache
  retires instead of precaching missing trial fonts. New UI uses system fonts.

## Verification

- `npm test`: **77 passed, 0 failed**.
- `npm run build`: passed.
- API integration tests cover Grow persistence across restart, exact approval,
  action execution, sandbox semantics, receipts and history.
- Offline reconnect test truncates a promise mid-event, recovers it by catch-up
  within five seconds and proves duplicate replay stores one commitment.
- Browser checked at desktop and 390px mobile: no horizontal overflow; synthetic
  goal saved; sandbox path prepared, approved, executed and receipts inspected.
- Real-account workspace API imports all four recovered files. Demo uses a
  separate synthetic ledger, pinned to October 19; its actions cannot silently
  be presented as real calendar or mail results.

## Gates that still do not pass

- Real outcome label gate: **0 known / 1,040 unknown**; required 100 known.
  Calendar presence does not establish attendance or task completion.
- Reconcile: **10 duplicate proposals / 130 open tasks**; required 33 with
  independent precision audit. All 248 unsupported facts remain pending.
- Independent precision audit: unavailable. Predictor: cannot evaluate; no
  completion model or personal completion percentages claimed.
- Dedicated demo identity is saved locally; external actions disabled pending
  the owner's Google login. Real sending/holds have not been rehearsed.
- Local d1 model-list endpoint returned HTTP 401 without auth. No inference was
  made and configuration presence is not a successful connection.
- Actual Bee speaker attribution and live disconnect/reconnect timing remain
  account-level rehearsal gates; offline tests do not stand in for those.

`npm run acceptance` writes the measured private report to
`app/data/acceptance-results.json` and exits nonzero for unmet gates. This
checkpoint completes implementable paths without manufacturing missing evidence
or a successful external integration.
