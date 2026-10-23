---
name: ambient
description: Triage a Bee wearer's commitments, fork their week, and clean up Bee's record through the Ambient MCP tools. Use when the user asks what to act on, whether they can take on a new promise, how a new commitment affects their week or a goal, to merge duplicate Bee to-dos, or to review their Bee record.
---

# Ambient

Ambient sits on top of a Bee wearable's record. It reads what the person promised, checks it against their calendar, handles small reversible work, and brings them only the decisions that are theirs. These tools read and write the same local ledger the Ambient app shows, so the agent and the screen never disagree.

## Setup

The MCP server ships in the repository:

```bash
claude mcp add ambient -- node /absolute/path/to/app/mcp-server.mjs
```

It needs a ledger at `app/data/ambient.sqlite` (run `npm run ingest` once) or `AMBIENT_DB` pointing at one. Calendar exports (`.ics`) in `app/data/calendars/` feed the fork.

## Tools

| Tool | Writes? | Use it to |
|---|---|---|
| `ambient_record` | no | Get the shape of the record: conversations, open and done to-dos, duplicates. |
| `ambient_should_act` | no | Name the single thing to act on now, with the reason. |
| `ambient_open_items` | no | List open items, most urgent first, each with its reason. |
| `ambient_goals` | no | Read the goals the person set (what the fork protects). |
| `ambient_fork_week` | no | Compare three paths for a new promise against a goal on the real calendar. |
| `ambient_duplicates` | no | List groups of rows that say the same thing. |
| `ambient_reconcile` | no | Read the proposed changeset: duplicate retirements and facts held for evidence. |
| `ambient_slip_risk` | no | A review queue. It returns no probability, on purpose. |
| `ambient_merge` | yes | Merge one duplicate group (or all) and write a receipt. |
| `ambient_close` | yes | Close one open item and write a receipt. |

## Workflows

**"What should I do?"** Call `ambient_should_act`. Say the item, why it is first, and the suggestion in one or two sentences. Offer the alternatives only if asked.

**"Can I take this on?"** (a new promise, a favor, a meeting)
1. Call `ambient_goals`. If there is no goal with a due date and minutes, ask what they are protecting and how many focused hours it needs.
2. Ask for the promise's effort and due date if the user did not say. Do not guess effort.
3. Call `ambient_fork_week` with `promise` (and `goal` if not using the saved one).
4. Report the three paths in hours: which fit, which fall short and by how much, and the recommended path. If the recommendation is to ask someone to move a date, say that a request is not their agreement.

**"Clean up Bee."** Call `ambient_duplicates` or `ambient_reconcile`, show what would change, and merge only after the user says yes. Report the receipt.

## Rules

- **Never act on someone else's promise.** "We should" and other people's commitments are remembered, not executed. If you cannot tell who said it, ask. Bee may report the speaker as Unknown; do not guess.
- **Ask before any write.** `ambient_merge` and `ambient_close` change the ledger. Confirm first, then quote the receipt.
- **Name states exactly.** A draft is not a send. A request is not an agreement. A calendar hold is not attendance. Closed in Ambient does not change Bee.
- **No invented numbers.** The fork is calendar arithmetic with stated assumptions (weekdays 9 to 5). Do not turn it into a probability of success, and do not report model scores that were not returned.
- **Rest counts.** Deferring or dropping a commitment is a valid outcome. Do not frame it as failure.
