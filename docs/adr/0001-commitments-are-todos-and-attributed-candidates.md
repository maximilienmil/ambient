# 0001 - A commitment is a Bee todo or an attributed candidate

- Status: accepted
- Date: 2026-10-17

## Context

The database holds 536 rows in `commitments`. They split exactly in two: 162 rows with `tier IS NULL` (130 live, 32 done) that mirror the `bee_todos` table, and 374 rows with a tier (234 ask, 91 draft, 49 remember) produced by the rule extractor from 30 conversations. The UI summed them into "504 open", and the pitch used that number as its headline.

Sampling the 374 showed that most are lecture transcript, not the wearer's promises: "Talk about this", "Know what it's big O of", "Quickly wrap up our discussion of the flip rope problem". Five trivial prefixes account for 63 rows. Roughly one in five reads as a real commitment.

## Decision

A row in `commitments` counts as a **commitment** only if it is (a) a Bee todo, or (b) a candidate that passed the attribution gate. The 374 rule extractions are **candidates** until then, and any number shown for them must name them as candidates and state how many survived the gate.

The product's headline population is **130 open Bee todos and 170 facts**. The candidate lane may appear, but never as the lead number.

## Consequences

- Every count in `ledger.mjs` must be labelled by population. A bare "open" number is a bug.
- The Record tab's per-rule rates ("shared-intent 0/234") describe candidates, not commitments, and must be relabelled or removed.
- The pitch loses the 504 headline and gains two honest ones: 130 open loops, 170 recorded beliefs.
- The `/decide` pipeline keeps its value: it ranks candidates and must show its survival rate, not assume it.
