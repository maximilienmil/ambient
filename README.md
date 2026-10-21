# Latent

**Room for what matters.**

Bee remembers everything you say. Latent decides what's worth your attention.

Latent is an ambient agent that sits on top of your [Bee](https://bee.computer) record. It reads what you promised, checks it against your calendar and the rest of your record, quietly handles the small stuff, and brings you only the decisions that are actually yours. It does not add another list to look at. It takes things off the one you already have.

![Horizon](docs/screenshots/horizon.png)

## Why

Bee captures a year of conversations and turns them into to-dos and facts. The result is a pile: duplicates, things already done, promises other people made, old intentions nobody dropped. The pile grows faster than anyone can read it, and more data does not mean more clarity.

Latent's answer is to do three things well:

1. **Handle what's low effort.** Merge duplicates, close what's demonstrably done, hold time for what you already decided. Every action has a receipt, an owner, and an undo.
2. **Show the choice, not the data.** When two things you said collide, Latent shows the real tradeoff in hours and lets you fork the week, so you can see each path before you take one.
3. **Check Bee's record against the world.** Old to-dos and unconfirmed facts get compared with your calendar and later conversations. Resolved work is cleared. Whatever is left is what actually needs you.

Rest, deferral and dropping work count as good outcomes. Latent never scores you, and it never tells you what you "really" want. Its readings are suggestions you can correct.

## Three screens

| | |
|---|---|
| **Horizon** | Your week as a decision. The hive's overnight work, what needs you, and **Fork the week**: three paths with their consequences on a real timeline. Approve one and the hive acts, then shows a receipt. |
| **Compass** | Where your time is heading. Editable goals, a one-tap daily check-in, week/month/year capacity, and a hive that grows with every conversation. Latent can also notice goals you act on but never wrote down. |
| **Reconcile** | Bee's old to-dos and unconfirmed facts, checked against evidence. Duplicates merge, resolved items close, and the models' disagreements come to you. |

![Fork the week](docs/screenshots/fork-the-week.png)

## The Friday story

An independent builder wants a first release out Friday. It needs six focused hours. Yesterday they told Jordan, "Sure, I'll help with the deck by Thursday." That favor takes three of those hours.

Latent shows the conflict in numbers, then three paths:

- **A. Protect the launch.** Ask Jordan to move the favor to Monday. The release ships Friday.
- **B. Keep the favor.** Help Jordan Tuesday. The release moves to Monday.
- **C. Ship smaller.** Keep both promises with a smaller first release.

Jev and System One (the decision models) each pick a path. If they agree, Latent recommends it. If they split, it asks. Approve A and the hive writes the message from your demo account, holds Tuesday and Thursday, and reports back. The result card says what it can honestly say: **a request is not a yes.** Jordan still has to agree.

## Who said it matters

Latent treats a promise differently depending on who made it.

- **You said it.** The hive can draft, hold time and follow through for you.
- **Someone told you.** The hive remembers it and waits. It never acts on someone else's promise.
- **Not sure who said it.** Latent asks. It does not guess.

## What's real and what's simulated

This is a hackathon build. The line between the two is deliberate and stated here.

| | Status |
|---|---|
| Bee ingest into a local SQLite ledger, with bystander speech dropped before storage | **Working.** Tested against one real account (334 conversations). |
| Reconcile: exact-duplicate detection, reversible merge, evidence-or-hold for facts | **Working.** Semantic duplicates are not built yet. |
| Capacity engine: free time from `.ics` calendars, effort vs. deadline, A/B/C comparison API | **Working** on a coherent synthetic launch scenario. |
| Actions: hash-bound approval, idempotent execution, durable receipts, partial-failure handling | **Working** in a sandbox. Real Gmail and Calendar sends are off until a demo account is connected. |
| MCP server: eight tools any agent can call (`latent_reconcile`, `latent_should_act`, `latent_merge`, ...) | **Working.** See [docs/mcp.md](docs/mcp.md). |
| Live Bee stream with reconnect and catch-up | **Working** from fixtures. A captured event is replayed in the demo and labeled as a replay. |
| The v5 interface in [`design/`](design/) | **Prototype.** Every number, name and model verdict on screen is synthetic and not yet wired to the backend. |
| Jev and System One verdicts | **Not run.** The adapter exists and the d1 endpoint is intentionally idle. The table in the prototype is illustrative. |
| Speaker attribution | **Known gap.** Bee reports `Unknown` on this account, so Latent never claims to know your voice. |
| Outcome prediction and forecasts | **Not built.** No independent labels exist, so Latent shows hours and arithmetic, not probabilities. |

Open items before submission are tracked in [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md).

## Try it

Requires Node 22.13 or newer.

**The backend and its screens, on synthetic data (no Bee needed):**

```bash
cd app
npm ci
npm run demo        # http://127.0.0.1:4317, marked "synthetic data"
npm test            # 77 tests, all offline
```

**The v5 design prototype:** open [`design/latent-v5.html`](design/latent-v5.html) in a browser. Press **Replay captured promise** on Horizon to watch a promise arrive, then pick a path and approve it. The iPhone frame next to it is the same interface at phone size.

**Use it from an agent (MCP):**

```bash
claude mcp add latent -- node /absolute/path/to/app/mcp-server.mjs
```

Then ask: *what should I act on?*

**Against a real Bee account:** run `npm run ingest`, then `npm start`. Data stays in `app/data/`, which is git-ignored. See [app/README.md](app/README.md).

## How it fits together

```
 Bee (wearable, CLI, API)
        |  conversations, to-dos, facts
        v
 Local ledger (SQLite, bystanders dropped)
        |
        +--> Evidence engine ------ later conversations, calendar (.ics)
        |         "is this resolved? is this the same task?"
        |
        +--> Capacity engine ------ free hours vs. effort vs. deadlines
        |         "what does each path actually cost?"
        |
        +--> Decision models ------- Jev, System One
        |         "act, ask, remember, or ignore?"
        v
 Hive (approval, one executor per action, receipts, undo)
        |
        +--> Gmail / Calendar connectors (demo account)
        +--> Other agents through MCP
        +--> Bee's own agent
```

Latent owns the context, the tradeoff, the recommendation, the approval and the result record. Anything that can execute an approved action may do so, but one approved action never runs through two executors.

## Principles

- **A draft is not a send. A request is not an agreement. A hold is not attendance.** Each state is named exactly.
- **Unknown stays unknown.** Missing evidence, missing models and missing attribution are shown, not smoothed over.
- **Local first.** The ledger lives on your machine. Real data never goes in this repository.
- **Nothing happens without your approval,** and everything can be undone.

## Repository

| Path | What's there |
|---|---|
| [`app/`](app/) | The local service, SQLite ledger, evidence and capacity engines, MCP server, and the production UI |
| [`design/`](design/) | The v5 interface prototype and the reference material it was designed from |
| [`docs/`](docs/) | Scope, design direction, glossary, MCP guide, decision records, demo script, archived specs |
| [`docs/adr/`](docs/adr/) | Why the product makes the claims it makes, and the ones it refuses to |

## License

[MIT](LICENSE). Third-party assets and fonts keep their own licenses; see [docs/OPEN-ITEMS.md](docs/OPEN-ITEMS.md) for what still needs to be cleared before this repository goes public.
