# AWS integration: Amazon Bedrock as a decision model

Ambient's decision layer (`app/decide/provider.mjs`) speaks the OpenAI Chat Completions contract. Amazon Bedrock exposes that same contract through its OpenAI-compatible endpoint, so Jev (and optionally Liquid d1) can run on Bedrock with no SDK and no code branch.

## What runs on Bedrock

| Ambient role | Bedrock model (default preset) | Used for |
|---|---|---|
| Jev | `openai.gpt-oss-120b-1:0` | Scores each commitment across ignore / remember / ask / draft / execute, and weighs in on the fork recommendation |
| Liquid d1 (optional) | `openai.gpt-oss-20b-1:0` | Fast System 1 read when the local model is unavailable |

When both models answer, `app/decide/policy.mjs` acts only if they agree with at least 0.6 probability each; disagreement routes the item to the person ("The models disagree" in Reconcile).

## Code path

1. `app/server.mjs` `POST /api/models` writes `JEV_BASE_URL`, `JEV_MODEL`, `JEV_API_KEY` to the git-ignored `.env`.
2. `app/decide/provider.mjs` `chat()` posts to `${JEV_BASE_URL}/chat/completions` with `Authorization: Bearer <Bedrock API key>`.
3. `app/decide/score.mjs` asks for a JSON distribution; `app/decide/policy.mjs` combines Jev and d1.
4. Endpoints: `POST /api/models/test` (connectivity), `POST /api/decide/item` (one promise), `POST /api/decide/run` (score a batch).

## Setup

1. AWS console → Amazon Bedrock → enable access to the gpt-oss models in `us-west-2`.
2. Bedrock → API keys → create a short-term or long-term key.
3. In Ambient: Settings → Jev → **Use Amazon Bedrock** → paste the key → Save → Test connection.

Or set it directly in `.env`:

```dotenv
JEV_BASE_URL=https://bedrock-runtime.us-west-2.amazonaws.com/openai/v1
JEV_MODEL=openai.gpt-oss-120b-1:0
JEV_API_KEY=<bedrock api key>
```

Then `cd app && npm run decide -- --limit 10` scores ten rows from the command line.
