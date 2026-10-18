# 0004 - Denominators: no rate without a settled population

- Status: accepted
- Date: 2026-10-17

## Context

Three displayed numbers were computed and false:

- Record showed **100%** kept, from `done / settled` = 32/32, with the 504 live rows excluded from the denominator (`ledger.mjs:961`).
- Record showed **"Breaks most: 0%"** for rule buckets where 0 of 374 rows had ever been closed.
- The preview dataset asserted a **63%** base rate while the real base rate is **19.8%** (32/162 Bee todos).

A judge who checks one number stops believing the rest.

## Decision

1. **Kept rate = `done / created`** across the stated population.
2. **No rate renders until its denominator contains at least one closure.** Otherwise the row shows the counts and "no closures yet".
3. **The base rate is 19.8%** and is the only follow-through rate quoted until a model beats it on a held-out slice.
4. Every rate carries its `n` next to it, and every number names its population.

## Consequences

- Record becomes smaller and more credible: the base rate, the counts, and the receipts.
- Per-phrase and per-audience cards lose their rates until closures exist; they keep counts.
- `preview-data.mjs` must stop asserting a 63% base rate, even labelled synthetic, because it is the number most likely to be quoted by mistake.
