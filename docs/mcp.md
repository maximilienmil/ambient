# Latent MCP server

Latent ships one tool layer over the ledger the app reads. An agent and the
screen cannot disagree about how many rows are open, because they read the same
SQLite file.

Transport is the MCP stdio convention: newline-delimited JSON-RPC on stdin and
stdout. No API key, no network call, no SDK dependency.

## Run

```bash
npm run ingest          # read Bee into data/latent.sqlite (once)
npm run mcp             # start the server
```

Point `LATENT_DB` at another ledger to run against a copy.

## Connect

Claude Code:

```bash
claude mcp add latent -- node /absolute/path/to/app/mcp-server.mjs
```

Any MCP client that speaks stdio:

```json
{
  "mcpServers": {
    "latent": {
      "command": "node",
      "args": ["/absolute/path/to/app/mcp-server.mjs"]
    }
  }
}
```

## Tools

| Tool | Kind | What it returns |
| --- | --- | --- |
| `latent_record` | read | Conversations, days of record, open and done todos, duplicate rows, measured completion rate |
| `latent_open_items` | read | Open todos, most urgent first, each with the reason for its position |
| `latent_duplicates` | read | Groups of rows that say the same thing |
| `latent_should_act` | read | The one row to act on now, why, the suggested action, and three alternatives |
| `latent_merge` | write | Merges one group by id, or every group with `all: true`. Keeps the copy with a due date. Writes a receipt |
| `latent_close` | write | Closes one open todo and writes a receipt |

Writes are visible to the app immediately, because both processes use the same
file. `latent_close` takes a single id and refuses anything that is already
closed.

## Why it is not a wrapper around the Bee API

Bee's API answers "what was recorded". It cannot answer "what is still open,
what is duplicated, what did the extractor get wrong, and what should I do
first". That reasoning lives in the ledger, so the tools are Latent's, not a
proxy.

## A session

```text
you:   what should I act on?
agent: latent_should_act
       -> "Discussion Leader: To the Lighthouse Day 2", due 15 April, 236 days open
       -> why: it carries a due date, and that date has passed
you:   close it
agent: latent_close { id: "c10eec..." }
       -> open: 119, receipt written
```
