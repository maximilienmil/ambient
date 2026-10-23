# Ambient: Devpost submission

Drafts for each field the Amazon Developer Hackathon asks for. Edit the voice, keep the facts.

## Track

- **Primary track:** Bee (Wearable AI). Priority use case: personal productivity.
- **Mini challenge:** Open Source (MIT-licensed public repository, plus the agent skill in `skills/ambient`).
- **Mini challenge:** AWS Builder. Jev runs on Amazon Bedrock (gpt-oss-120b) through Bedrock's OpenAI-compatible API. Integration documented in `docs/AWS.md`. Confirm Test connection succeeds before submitting.

## Project description

**Ambient: room for what matters.**

Bee remembers everything you say. After a year that is hundreds of conversations, 162 to-dos and 421 facts, many of them duplicates, already done, or someone else's promise. Remembering everything is not the same as knowing what matters.

Ambient is an ambient agent on top of Bee. It reads your real Bee record through the Bee CLI into a local ledger and does three things:

1. **Handles the small stuff.** Merges duplicate Bee to-dos, holds facts Bee is unsure about for your confirmation, and records a receipt and an undo for everything it does.
2. **Forks your week.** When you say yes to something new ("Sure, I'll help with the deck by Thursday"), Ambient compares three paths against the goal you are protecting, using your real calendar: protect the goal, keep every promise, or shrink the goal. Each path is calendar arithmetic, not a guess. Two decision models (Jev, and Liquid d1 as the System 1 model) weigh in; when they disagree, Ambient asks you.
3. **Acts, and tells the truth about it.** Approve a path and the hive prepares the message and holds the time, through a sandbox or a connected Google account, with a hash-bound approval and a receipt. A request is labeled as a request, not an agreement.

The same capabilities are open to any agent: a Model Context Protocol server (stdio, and Streamable HTTP per spec 2025-11-25) exposes ten tools, including `ambient_fork_week`, and an agent skill teaches the workflows and rules.

**How it works.** Node.js local service and SQLite ledger. `app/bee.mjs` calls the Bee CLI (`bee conversations`, `bee todos`, `bee facts`, `bee stream`) for ingest and live updates. Bystander speech is dropped before storage. A capacity engine (`app/horizon.mjs`) places work into free calendar time from `.ics` exports. Actions run through `app/actions.mjs` with idempotent, hash-bound approvals. The web app works on desktop and installs to an iPhone home screen.

**What's real.** The Your Bee mode reads a real account: 169 conversations and counting, 162 to-dos, 421 facts, 4 calendars. The Demo mode replays a scripted, labeled story so judges can see the full flow in 90 seconds.

## Built during the hackathon

**Confirm before submitting.** The repository's first commit is October 18, 2026 and already contains a working ingest and an earlier four-screen app. If any of that predates the submission window, say so here and list what changed during the window: the reconcile engine, the calendar capacity engine and fork, the action bundles, the v5 interface (Horizon, Compass, Reconcile) with Demo and Your Bee modes, the decision-model settings, MCP over Streamable HTTP, the `ambient_fork_week` tool and the agent skill.

## Product feedback

**Bee CLI** (ingest, stream, todos, facts, search)
- *Used for:* reading conversations with utterances, to-dos, facts, and a live event stream into a local ledger.
- *Worked well:* authentication (`bee login`, `bee status`) was quick, `bee ping` made connectivity easy to check, and JSON output was straightforward to parse. `bee stream` plus `bee changed` made a reliable reconnect-and-catch-up path possible.
- *Needs work:* every utterance on this account reports the speaker as `Unknown`, so an app cannot tell "I'll do it" from someone else saying it. To-do completion has a flag but no completion timestamp, so you cannot tell when something was done. Facts carry no confidence or source conversation, which makes verifying them hard.
- *Onboarding:* good once Developer Mode was on. The docs could show a full example of the utterance and to-do JSON shapes.
- *Would build again:* yes.

**Bee MCP**
- *Used for:* exploring the data model before writing the ingest adapter.
- *Needs work:* a documented tool list with input and output schemas would help agent builders.

**Model Context Protocol (Alexa+ ecosystem)**
- *Used for:* exposing Ambient's ledger and fork to any agent, over stdio and Streamable HTTP.
- *Worked well:* the spec is small enough to implement without an SDK.

**Amazon Bedrock**
- Amazon Bedrock as the Jev decision-model endpoint through its OpenAI-compatible Chat Completions API. Configured in Settings; no code changes needed because `app/decide/provider.mjs` speaks that contract.

## Friction log

| # | Task | Steps | Expected | Actual | Severity | Workaround | Suggestion |
|---|---|---|---|---|---|---|---|
| 1 | Tell the wearer's own promises from other people's | Ingested 169 conversations with utterances | A speaker label for the wearer | All utterances `speaker: Unknown` on this account | High | Label by phrasing ("I'll" vs "we should") and ask before acting | Expose wearer attribution, even as a confidence |
| 2 | Know when a to-do was finished | Read `bee todos` | `completed_at` with the flag | Only `completed: true` | Medium | Treat the flag as a prior; require calendar or later-conversation evidence | Add a completion timestamp |
| 3 | Verify a fact Bee saved | Read `bee facts` | Source conversation and confidence | Text, tags and a confirmed flag only | Medium | Hold all unconfirmed facts for user review | Link facts to their source utterances |
| 4 | Find duplicate to-dos | Grouped open to-dos by text | Bee de-duplicates repeated mentions | The same task appears up to 10 times | Medium | Exact-text merge with undo | De-duplicate on creation, or expose a group id |
| 5 | Resume after a dropped stream | `bee stream`, then network drop | A resume cursor | Events missed during the gap | Low | Catch up with `bee changed` after reconnect | Document the recommended reconnect pattern |

*Environment for every row: macOS 26.6.2, Node 26.8, `@beeai/cli` 0.7.3, one real account, 18 to 22 October 2026. Commands: `bee conversations list --json`, `bee conversations get <id>`, `bee todos list --json`, `bee facts list --json`, `bee stream`, `bee changed`, run through `app/bee.mjs` by `npm run ingest` and `npm run stream`.*

## Feature requests

- **Wearer attribution on utterances.** Critical. Without it no agent can safely act on "I'll do it."
- **Completion timestamps on to-dos.** Important. Enables honest "done when" evidence.
- **Fact provenance.** Important. Lets apps verify instead of asking the user to comb through.
- **Write API for to-do merge or close.** Nice to have. Ambient keeps changes local today.

## Media

- **Cover image (1200×630):** `docs/media/cover.png` (wordmark) or `docs/media/cover-fork.png` (the fork).
- **Screenshots for the gallery, in order:** `desktop-horizon.png`, `desktop-heard.png`, `desktop-fork.png`, `iphone.png`, `desktop-compass.png`, `desktop-rec.png` (all in `docs/media/`, Demo mode, synthetic data).
- **Launch films:** five silent cuts render from `launch/` (see `launch/README.md`). Upload `ambient-room.mp4` to YouTube as the launch film; the judged demo video is the narrated walkthrough in `docs/video-script.md`, under 3 minutes.

## Reviewers (if the repo stays private)

Add as collaborators at submission time (invitations expire after 7 days): knmeiss, giolaq, anishamalde, mosesroth, emersonsklar. Also share with testing@devpost.com.
