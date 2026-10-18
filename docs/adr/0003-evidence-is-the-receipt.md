# 0003 - `evidence` is the receipt, not the source span

- Status: accepted
- Date: 2026-10-17

## Context

The required Commitment schema has both source-location fields (`quote`, `source_conversation_id`, `span_start`, `span_end`) and an `evidence` field. Today `evidence` holds `{"utteranceId":..., "speaker":"Unknown", "rule":..., "provisional":true}` - that is a pointer back to the same audio that produced the claim.

`decide/evidence.mjs:96` always returns `signals: 'not checked'` because `decide/run.mjs:212` never passes a provider. So the Trust tab's "receipt" is the claim citing itself. That is the exact complaint The Verge made about memory products ("fact-checking your memories is a dystopia").

## Decision

`evidence` stores the **closure receipt**: the provider that fired, the record it matched, the timestamp, and the confidence. The source span stays in the four fields that already exist for it. A state change without a receipt is not a closure, and the UI must show "no receipt" rather than a quote card.

`decide/evidence.mjs` may not render a checked state unless a provider actually produced one. `signals: 'not checked'` is a valid, visible state.

## Consequences

- The Trust tab stops showing "here is where you said it" as if it were proof.
- Closing a commitment requires writing a receipt, so `closed_by` and `evidence` become the audit trail.
- Existing rows keep their pointer data but it is migrated into the source-span fields and removed from `evidence`, so no row can display a false receipt.
