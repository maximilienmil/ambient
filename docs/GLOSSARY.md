# Latent - Glossary

One context. These definitions are normative: when code, copy or a slide disagrees with this file, the code or copy is wrong.

## The record Bee gives us

- **Conversation** - one recording session pulled by `bee conversations list` (30 exist). Contains utterances.
- **Utterance** - one transcript line (`utterances`, 22,366 exist). Carries `speaker`, which is `Unknown` on every row today. See *attribution*.
- **Fact** - an assertion Bee writes about the wearer (`facts`, 170 exist). Always third person ("Is a French native speaker..."). `confirmed` is Bee's own flag and is `1` on all 170, so it is not a review state.
- **Bee todo** - a task Bee extracted from a conversation (`bee_todos`, 162 exist: 130 open, 32 completed). Bee has already attributed it to the wearer, so it is usable as-is.

## Latent's units

- **Candidate** - a promise-shaped span Latent extracts from an utterance with the rule extractor (`extract.mjs`). 374 exist. A candidate is *not yet* a commitment.
- **Commitment** - the ledger unit, and the only thing the product counts. It has exactly two legitimate provenances:
  1. a Bee todo (already attributed by Bee), or
  2. a candidate that passes the *attribution gate*.
- **Attribution** - the reason to believe the wearer, not someone else, said the words. Today there is no speaker diarisation (`speaker = Unknown`), so attribution is a stated heuristic, never a claim about voice.
- **Attribution gate** - the filter a candidate must pass to become a commitment (first person, not lecture imperative, not a question the wearer asked). The number that survives must be shown on screen.
- **Closure** - a commitment reaching a terminal state (`done`, `obsolete`, `forgotten`) **with a receipt**. A state change without a receipt is an assertion, not a closure.
- **Receipt** - the record of the signal that justified a closure: which provider, what it matched, when, and how confident. Stored in `commitments.evidence`.
- **Source span** - where the words came from (`quote`, `source_conversation_id`, `span_start`, `span_end`). This is *not* a receipt and must never be labelled as one.
- **Signal** - one provider result (`bee-todo`, `later-utterance`, `sent`, `calendar`, `gradescope`). `decide/evidence.mjs` returns `signals: 'not checked'` when no provider is configured.
- **Tier** - the persisted non-terminal action class: `remember | ask | draft`. Terminal states carry the other two actions.
- **Action** - the five-way label derived from a row, never stored separately: `done` -> execute; `obsolete | forgotten` -> ignore; `blocked` -> ask; otherwise the tier; otherwise `unscored`.
- **Unscored** - no model has produced a probability for the row (`p` is null). True for all 536 rows today, including all 162 Bee todos.
- **Reconcile** - the operation that compares a commitment against signals and *proposes* a state change with a receipt. `db.mjs:347 reconcileTodoState` currently does something much narrower (it copies Bee's completed flag); treat that name as legacy.
- **Kept rate** - `done / created`. Not `done / settled`.
- **Base rate** - the share of Bee todos the wearer actually completes: 32/162 = 19.8%. The only rate quoted until a model is fitted.
- **Preview** - the synthetic ledger served only under `PREVIEW=1`. Never enters the real read path, never appears in the submission video.
- **Ledger** - the whole read model in `ledger.mjs` (`today`, `record`, `trust`).
- **Twin** - the radial view of the ledger. Distance encodes days open, not importance.

## Retired language

Do not use these in copy, slides or the video:

- **"504 open commitments"** - that number sums two populations with different reliability. Quote 130 open Bee todos and 170 facts.
- **"It knows your voice"** - there is no speaker label. Say "it hears what was said" or drop the claim.
- **"Decision model"** for tiering - the tiers on the 374 candidates came from regex rules, not Jev or d1. Say "rule-assigned tier" until the models actually score rows.
- **"Receipt"** for a quote card - a receipt points outside the thing that made the claim.
- **"Close rate"** for 100% - that was `done / settled` with zero settled rows that were not done.
