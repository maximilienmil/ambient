# Imply: Hackathon Spec

*Working name. Alternates: Latent, Motive. Names are not availability-checked.*

## One-line pitch

What you say you'll do and what you do are different. Imply closes that gap from the conversations you are already having, decides with a visible decision model when it is safe to act, shows its receipts for every action, and coordinates with other people's agents so plans get made without a group chat.

## The thesis

Most ambient AI demos show conversation turned into a to-do list. That is crowded, and Bee already does a version of it. Imply takes a different stance on what the product is for:

1. **Intention-action gap.** People say they will do things and then do not. Imply compares stated commitments (from conversation) with observed follow-through (calendar, email, sent files) and surfaces the drift.
2. **Restraint as a feature.** The agent decides between ignoring, remembering, asking, drafting, and executing, and shows why. Not acting is a first-class output.
3. **Receipts.** Every action links back to the exact seconds of conversation that caused it, with the inference chain visible.
4. **Agent-to-agent coordination.** Two people say "we should get dinner sometime" and their agents negotiate a time and place within each person's consent boundaries. This moves ambient AI from a personal tool to a social layer, which is where a single-device company is structurally weak.

The question the pitch ends on: **What if agents didn't need prompts, and still earned your trust?**

## The core feature: the Commitment Loop

A commitment is anything someone promises or agrees to in conversation, in either direction ("I'll send you the deck", "let's get dinner sometime", "you'll intro me to Priya").

The loop, end to end:

1. **Detect.** Extract candidate commitments from a transcript, with owner, counterparty, deadline (if any), and a calibrated confidence.
2. **Decide.** The decision model chooses an action tier (see below).
3. **Act.** Draft the email, attach the file, create the calendar hold, or start a negotiation with the counterparty's agent.
4. **Prove.** Attach a receipt: transcript clip, inference chain, confidence, and the reason this tier was chosen.
5. **Track.** Mark the commitment open, in progress, done, or drifting, based on real signals.
6. **Close.** Chase when a commitment drifts, and report the gap in a nightly summary.

## Decision model

The model is deliberately simple and explainable so judges can see it work. It is an expected-utility policy over action tiers.

**Action tiers (ordered by risk):** ignore, remember silently, ask the user, draft for approval, execute.

**Inputs per candidate commitment:**

- `p`: calibrated probability that the inferred intent is real and correctly specified
- `benefit`: value of acting now (deadline proximity, user-stated priority, how often the user has dropped this type of task)
- `cost_wrong`: cost if the action is wrong, driven by reversibility, external visibility, and whether a third party is touched
- `cost_interrupt`: attention cost of asking, scaled by an interruption budget per hour and per day

**Policy:**

- Execute only if `p * benefit - (1 - p) * cost_wrong` clears a high threshold and the action is reversible or internal.
- Draft if expected value is positive but the action is external or irreversible.
- Ask if the value of the information exceeds `cost_interrupt`.
- Otherwise remember or ignore.

**Learning:** a lightweight update from user feedback (approve, edit, reject) adjusts per-action-type thresholds. A contextual bandit is enough for the demo. Do not build a POMDP in a weekend; mention it as the roadmap.

**Calibration:** fit `p` on the labeled eval set so a stated 70 percent really means about 70 percent. Show the calibration curve.

## Agent-to-agent coordination

The headline demo moment.

- Each user has an agent with a private profile: calendar free/busy, preferences, and consent rules.
- When a shared commitment is detected on both sides (or one side with the other's agent reachable), the agents run a propose-counter-accept exchange.
- **Disclosure minimization:** agents share only what the protocol needs (candidate windows, venue constraints), never reasons or full calendars.
- **Consent boundary:** an agent acts only on its own user's intents and ignores or redacts bystander content.
- Each side's user approves the final plan at the tier the decision model assigns. Both sides get a receipt.

For the hackathon, the counterparty agent can be a second instance running with a different persona and fixture calendar. Be upfront about that in the demo.

## Consent and privacy

- Acts only on the wearer's own commitments.
- Bystander speech is not used to trigger actions and is redacted from stored transcripts after extraction.
- A "what I chose not to keep" view shows what was discarded.
- All agent-to-agent traffic is logged and visible to both users.

## Demo script (under 2 minutes)

1. **Setup (15s).** Two people have a normal conversation that includes "we should get dinner sometime" and "I'll send you the deck."
2. **Restraint (20s).** The live decision view shows both commitments scored. The dinner item is 58 percent confident, so it only drafts. The deck item is 91 percent confident and reversible, so it queues the email.
3. **Agent negotiation (30s).** The two agents exchange proposals on screen and land on Thursday at 7. Neither calendar is exposed.
4. **Receipts (20s).** Tap the calendar hold and hear the exact clip and see the reasoning.
5. **The gap (25s).** Fast-forward a week. The dashboard shows "stated 6 commitments, completed 2, 3 drifting, 1 chased" and the nightly hindsight summary.

## Eval (the part most teams skip)

- Record or script about 20 realistic conversations and label the true intents, including cases where the right answer is to do nothing.
- Report: precision and recall of commitment detection, precision of proactive actions, calibration error, and false-action rate.
- Compare three policies: always act, always ask, and the decision model. The claim to show is fewer wrong actions at similar completion.
- Optional stretch: measure commitments completed with and without the system on a small set of volunteers.

## Scope

**Must have**

- Commitment extraction from Bee transcripts (or fixtures)
- Decision model with the five tiers and a live decision view
- Receipts with transcript clip and reasoning
- One executed action type (email draft or calendar hold)
- Two-agent negotiation for one scenario
- Small eval with a results slide

**Should have**

- Drift tracking against calendar and sent mail
- Nightly hindsight summary
- Approve, edit, reject feedback that updates thresholds

**Cut if time runs short**

- Multilingual intent (English, French, Russian code-switching)
- Negative-space detection (missing owner, undecided questions)
- More than one counterparty
- Any real-world sending without approval

## Architecture sketch

- **Ingest:** Bee API or recorded transcripts with timestamps.
- **Intent layer:** LLM extraction into structured commitments with confidence and source spans.
- **Decision layer:** expected-utility policy plus a small feedback learner.
- **Action layer:** email and calendar connectors, with draft-first defaults.
- **Coordination layer:** a simple message protocol between two agent instances.
- **UI:** decision view, receipts, commitment ledger, gap dashboard.

## Open questions to resolve first

1. What the Bee API or SDK exposes (raw transcripts, audio, timestamps, webhooks), which decides how real the ingest can be.
2. The hackathon's judging criteria and whether partner APIs are required.
3. Whether calendar and email access is realistic in the time, or whether to use fixtures for the drift story.
4. Name and domain availability.

## Risks

- **Conversation-to-task framing.** Judges will have seen it. Lead with restraint, receipts, and the gap, not extraction.
- **Scope creep.** The negotiation demo and the eval are the two things that must work. Everything else bends.
- **Fake-looking counterparty.** Be explicit that the second agent is simulated, and show the protocol logs.
- **Calibration claims without data.** Only show numbers you measured.
