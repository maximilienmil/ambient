# decide/ — the decision pipeline

Turns one Bee commitment into a tier (`ignore | remember | ask | draft | execute`)
with a probability, using two independently configured models (Jev and d1) that
are allowed to disagree, plus a pure policy and real calibrators.

Nothing here invents a number. A vendor that is not configured is reported as
not configured; a price that was not supplied yields `cost: null`; a latency is
only reported when it was measured.

## Files

| File | Role |
| --- | --- |
| `provider.mjs` | One provider-agnostic chat adapter (global `fetch`, no SDK). |
| `schema.mjs` | Dependency-free validators for the extraction JSON and a 5-way distribution. |
| `extract.mjs` | One transcript span → validated commitment fields. Rejects instruction-like input before any model call. |
| `evidence.mjs` | The evidence block the decision models may see. Pure and deterministic. |
| `score.mjs` | Calls Jev and d1, validates each distribution, records usage/latency/cost. |
| `policy.mjs` | Pure `{tier, p, reason}` from the two distributions plus the evidence. |
| `calibrate.mjs` | Temperature scaling, isotonic regression, ECE, fitted on `labels.json`. |
| `run.mjs` | CLI (`npm run decide`): score unscored rows and write the verdict back. |
| `eval.mjs` | CLI (`npm run eval`): the comparison table, written to `decide/eval-results.json`. |
| `eval-results.json` | Machine-readable output of the last `npm run eval`. |

## Endpoints the code calls

The chat adapter speaks the documented OpenAI Chat Completions contract, read
before the code was written:
[`POST /chat/completions`](https://platform.openai.com/docs/api-reference/chat/create).

- Request body: `model`, `messages`, optional `temperature`, optional
  `response_format` = `{ "type": "json_object" }`.
- Response: `choices[0].message.content` (a string), `usage.prompt_tokens`,
  `usage.completion_tokens`, `usage.total_tokens`.
- Auth header: `Authorization: Bearer <key>`.

Any server that speaks the same contract works by pointing `<ROLE>_BASE_URL` at
it (the path appended is `/chat/completions`). Transcript text is untrusted
data and is sent only inside a JSON payload that is labelled as untrusted.

## Environment variables

One set per role. A role is "configured" only when its base URL, key and model
are all present; otherwise it is "not configured" and the adapter throws
`NotConfiguredError` — it never substitutes a default.

| Variable | Meaning |
| --- | --- |
| `JEV_BASE_URL` / `D1_BASE_URL` / `EXTRACT_BASE_URL` | Base URL of the OpenAI-compatible server. |
| `JEV_API_KEY` / `D1_API_KEY` / `EXTRACT_API_KEY` | Bearer key for that role. |
| `JEV_MODEL` / `D1_MODEL` / `EXTRACT_MODEL` | Model id sent in the request body. |
| `JEV_PRICE_IN` / `JEV_PRICE_OUT` (and `D1_*`, `EXTRACT_*`) | USD per **million** tokens. If either is unset, `cost` is reported as `null`. |
| `JEV_TIMEOUT_MS` / `D1_TIMEOUT_MS` / `EXTRACT_TIMEOUT_MS`, or `DECIDE_TIMEOUT_MS` | Request timeout in ms (default 30000). |
| `LATENT_DB` | SQLite file for `run.mjs` (default `app/data/latent.sqlite`). |

Prices are only ever read from these variables. No price table is hard-coded.

## The five options

Declared everywhere as exactly `['ignore', 'remember', 'ask', 'draft', 'execute']`
(`decide/schema.mjs`). Distributions must be non-negative and sum to 1 within
`1e-6`, or they are rejected with the offending field named.

## Policy constants

Documented in `decide/policy.mjs`:

- `AGREEMENT_THRESHOLD = 0.6`. Both models must agree on the top option and each
  must put at least this much probability on it, or the tier is `ask`.
- `execute` is allowed only when the evidence says the action is reversible or
  internal (`evidence.reversible === true` or `evidence.internal === true`).
  Anything external, or unknown, becomes `draft`.
- `p` is the mean of the two models' probability for the chosen tier, clamped to
  `[0, 1]`. When an agreed `execute` is downgraded to `draft`, `p` is the mean
  probability for `execute`. A security refusal (`p` null) is a deterministic
  rule, not a model probability.

## Hand-label mapping (calibration)

`decide/calibrate.mjs` maps the hand labels in `labels.json` to the action space,
with the assumption documented in the file:

```
done -> execute   obsolete -> ignore   forgotten -> ignore   live -> remember
```

A hand label records the outcome state the owner observed, not the action a
policy should have chosen, so `ask` and `draft` have no counterpart. Rows that
cannot be mapped (a null or unrecognised label, or no probability) are excluded
and counted. If no row is usable, the tool prints `no labelled rows` and prints
no number.

## How to run

```bash
npm test                                   # full suite, no network
npm run eval                               # the comparison table (offline)
npm run eval -- --predictions decide/predictions.json
npm run decide                             # score unscored rows; needs JEV_* and D1_*
npm run decide -- --dry-run                # score without writing
npm run decide -- --predictions decide/predictions.json
node decide/calibrate.mjs                  # ECE before/after on labels.json
```

`npm run decide` prints exactly which env vars are missing and exits non-zero,
without writing anything, when either decision model is not configured. The
per-row summary prints `id`, tier, `p`, and both models' top options; the last
line is the count.

## What is not configured on this machine

At the time of writing, none of `JEV_*`, `D1_*` or `EXTRACT_*` is set, and
`labels.json` has no filled-in `label` values. So:

- `npm run decide` prints the missing variables and exits 1.
- `npm run eval` prints the vendor rows as `not configured` and the LLM-only
  baseline row from the recorded `evaluation-results.json` rule baseline
  (accuracy 0.833 = 20/24 on the development smoke set; calibration, latency and
  cost are `null` because rules emit none).
- `node decide/calibrate.mjs` prints `no labelled rows`.

No latency, cost or probability has been invented to fill those gaps.

## Boundaries

- The rule baseline in `evaluation-results.json` is a development smoke set
  authored alongside the rules, not a held-out benchmark.
- `AGREEMENT_THRESHOLD = 0.6` is a product threshold, not a fitted value; there
  are not yet enough labelled rows to fit one honestly.
- External signals (calendar, sent mail) are an injectable provider. With none
  configured, the evidence block says `signals: 'not checked'`.
