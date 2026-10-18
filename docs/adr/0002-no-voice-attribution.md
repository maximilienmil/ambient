# 0002 - No voice attribution until there is a speaker label

- Status: accepted
- Date: 2026-10-17

## Context

The pitch claim "it also knows my voice, so it should know when I've said something and not acted on it" depends on knowing who spoke. `utterances.speaker` is `Unknown` on all 22,366 rows across all 30 conversations, and every stored evidence blob carries `"speaker":"Unknown"`. Bee does not diarise this account's audio.

Without attribution, the extractor cannot distinguish the wearer saying "I'll send that Tuesday" from a lecturer saying "try it on the small example first". That is why the 374 candidates are 80% lecture content.

## Decision

The product makes no claim about voice or speaker identity. The attribution gate is a **stated heuristic** over text and context (first person, not a bare imperative, not an interrogative, not immediately preceded by a second-person address), and its survival count is displayed wherever candidates are counted. The claim in the pitch becomes "Bee hears what was said; Latent keeps only what you promised, and says how much it discarded."

If diarisation arrives later, it becomes an input to the gate, and this ADR is superseded.

## Consequences

- The video and README must not say "knows your voice".
- The gate needs a test with adversarial lines (a lecturer's imperative, a quoted instruction, a bystander line) alongside the existing prompt-injection test.
- The 374-row lane stays visibly separate from the 130 Bee todos, because its provenance is weaker.
