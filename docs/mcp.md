# Ambient MCP server

Ambient was called Ambient during development; tool names keep the `ambient_` prefix so existing agent setups keep working.

Ambient ships one tool layer over the ledger the app reads. An agent and the
screen cannot disagree about how many rows are open, because they read the same
SQLite file.

Transport is the MCP stdio convention: newline-delimited JSON-RPC on stdin and
stdout. No API key, no network call, no SDK dependency.

## Run

```bash
npm run ingest          # read Bee into data/ambient.sqlite (once)
npm run mcp             # start the server
```

Point `AMBIENT_DB` at another ledger to run against a copy.

## Connect

Claude Code:

```bash
claude mcp add ambient -- node /absolute/path/to/app/mcp-server.mjs
```

Any MCP client that speaks stdio:

```json
{
  "mcpServers": {
    "ambient": {
      "command": "node",
      "args": ["/absolute/path/to/app/mcp-server.mjs"]
    }
  }
}
```

## Tools

| Tool | Kind | What it returns |
| --- | --- | --- |
| `ambient_goals` | read | The goals set in Compass, with due dates and remaining focused minutes |
| `ambient_fork_week` | read | Three paths for a new promise against a goal on the real calendar: hours that fit, shortfalls, focus blocks, a recommended path. Calendar arithmetic, no probability |
| `ambient_reconcile` | read | Reversible proposals for exact duplicate todos and a hold receipt for each unsupported fact; never applies them |
| `ambient_slip_risk` | read | A review queue with explicit reasons; no probability while independently labeled outcomes are missing |
| `ambient_record` | read | Conversations, days of record, open and done Bee todos, duplicate rows, and Bee's recorded completion-flag rate |
| `ambient_open_items` | read | Open todos, most urgent first, each with the reason for its position |
| `ambient_duplicates` | read | Groups of rows that say the same thing |
| `ambient_should_act` | read | The one row to act on now, why, the suggested action, and three alternatives |
| `ambient_merge` | write | Merges one group by id, or every group with `all: true`. Keeps the copy with a due date. Writes a receipt |
| `ambient_close` | write | Closes one open todo and writes a receipt |

Writes are visible to the app immediately, because both processes use the same
file. `ambient_close` takes a single id and refuses anything that is already
closed.

## Agent skill

[`skills/ambient/SKILL.md`](../skills/ambient/SKILL.md) tells an agent when to use these tools, the three workflows (what to act on, can I take this on, clean up Bee) and the rules: never act on someone else's promise, ask before writes, and name states exactly.

## Why it is not a wrapper around the Bee API

Bee's API answers "what was recorded". It cannot answer "what is still open,
what is duplicated, what did the extractor get wrong, and what should I do
first". That reasoning lives in the ledger, so the tools are Ambient's, not a
proxy.

## A session

```text
you:   what should I act on?
agent: ambient_should_act
       -> "Discussion Leader: To the Lighthouse Day 2", due 15 April, 236 days open
       -> why: it carries a due date, and that date has passed
you:   close it
agent: ambient_close { id: "c10eec..." }
       -> open: 119, receipt written
```
