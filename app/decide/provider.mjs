// One provider-agnostic chat adapter for the whole decision layer.
//
// The wire contract is the documented OpenAI Chat Completions API, read before
// this file was written:
//   https://platform.openai.com/docs/api-reference/chat/create
// The parts this adapter relies on, quoted from that page:
//   - `P POST /chat/completions`
//   - body `model: string`, `messages: array of ChatCompletionMessageParam`,
//     optional `temperature`, optional `response_format`
//   - `response_format` = `ResponseFormatJSONObject { type: "json_object" }`
//     ("ensures the message the model generates is valid JSON")
//   - response is a `ChatCompletion`:
//       `{ id, choices: [ { index, finish_reason, message: { role, content } } ],
//          created, model, usage }`
//     where `message.content` is "The contents of the message" (string or null)
//     and `usage` = `{ prompt_tokens, completion_tokens, total_tokens }`
//   - auth header is `Authorization: Bearer <key>` (Authentication section of
//     the same page).
//
// A server that speaks this same contract works by pointing <ROLE>_BASE_URL at
// it. No SDK and no npm dependency are used: only global `fetch`. `fetchImpl`
// is injectable so tests never touch the network.
//
// Never guess a number: a role whose env is incomplete is NOT configured and
// `chatJson` throws `NotConfiguredError`. Cost is reported only when both
// `<ROLE>_PRICE_IN` and `<ROLE>_PRICE_OUT` were supplied (`null` otherwise).

export const ROLES = ['jev', 'd1', 'extract'];

const DEFAULT_TIMEOUT_MS = 30_000;

/** A role is missing required configuration. Never a fallback, always visible. */
export class NotConfiguredError extends Error {
  constructor(role, missing) {
    super(`${role} model is not configured (missing: ${missing.join(', ')})`);
    this.name = 'NotConfiguredError';
    this.code = 'not_configured';
    this.role = role;
    this.missing = missing;
  }
}

/** The provider answered, but not with a usable Chat Completions body. */
export class ProviderError extends Error {
  constructor(message, { role, status = null, detail = '' } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = 'provider_error';
    this.role = role;
    this.status = status;
    this.detail = detail;
  }
}

const clean = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

const numberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Resolve one role's configuration from the environment.
 * `configured` is true only when base URL, API key and model are all present.
 */
export function roleConfig(role, env = process.env) {
  const prefix = String(role).toUpperCase();
  const baseUrl = clean(env[`${prefix}_BASE_URL`]);
  const apiKey = clean(env[`${prefix}_API_KEY`]);
  const model = clean(env[`${prefix}_MODEL`]);
  const missing = [];
  if (!baseUrl) missing.push(`${prefix}_BASE_URL`);
  if (!apiKey) missing.push(`${prefix}_API_KEY`);
  if (!model) missing.push(`${prefix}_MODEL`);
  const priceIn = numberOrNull(env[`${prefix}_PRICE_IN`]);
  const priceOut = numberOrNull(env[`${prefix}_PRICE_OUT`]);
  const timeoutMs = numberOrNull(env[`${prefix}_TIMEOUT_MS`]) ?? numberOrNull(env.DECIDE_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
  return {
    role,
    configured: missing.length === 0,
    baseUrl,
    apiKey,
    model,
    priceIn,
    priceOut,
    priced: priceIn !== null && priceOut !== null,
    timeoutMs,
    missing,
  };
}

/** A description safe to print: never includes the API key. */
export function describeRole(role, env = process.env) {
  const config = roleConfig(role, env);
  return {
    role: config.role,
    configured: config.configured,
    baseUrl: config.baseUrl,
    model: config.model,
    priced: config.priced,
    missing: config.missing,
  };
}

/** `POST /chat/completions` against the configured base URL (doc above). */
export function chatCompletionsUrl(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
}

/**
 * Cost in USD from real token counts and real per-million prices.
 * Returns null unless both prices were supplied: a missing price is never
 * treated as zero.
 */
export function costOf(usage, config) {
  if (!config?.priced) return null;
  if (!usage) return null;
  const { promptTokens, completionTokens } = usage;
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  return (promptTokens * config.priceIn + completionTokens * config.priceOut) / 1_000_000;
}

function normaliseUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const promptTokens = Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null;
  const completionTokens = Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null;
  const totalTokens = Number.isFinite(usage.total_tokens) ? usage.total_tokens : null;
  if (promptTokens === null && completionTokens === null && totalTokens === null) return null;
  return { promptTokens, completionTokens, totalTokens };
}

/**
 * One chat completion call.
 *
 * @returns {Promise<{configured: true, role, model, content, finishReason,
 *   usage, latencyMs, cost, id}>}
 * @throws {NotConfiguredError} when the role's env is incomplete.
 * @throws {ProviderError} on a non-2xx response or an unusable body.
 */
export async function chat({
  role,
  messages,
  responseFormat = null,
  temperature = null,
  timeoutMs = null,
  fetchImpl = null,
  env = process.env,
  signal = null,
} = {}) {
  const config = roleConfig(role, env);
  if (!config.configured) throw new NotConfiguredError(role, config.missing);
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ProviderError(`chat(${role}) needs at least one message.`, { role });
  }
  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new ProviderError('No fetch implementation is available.', { role });
  }

  // Body fields and names per the doc cited at the top of this file.
  const body = { model: config.model, messages };
  if (Number.isFinite(temperature)) body.temperature = temperature;
  if (responseFormat) body.response_format = responseFormat;

  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs ?? config.timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abort, { once: true });
  }

  const startedAt = Date.now();
  let response;
  try {
    response = await doFetch(chatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ProviderError(`${role} request failed: ${error?.message || error}`, { role });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
  const latencyMs = Date.now() - startedAt;

  const raw = await response.text();
  if (!response.ok) {
    throw new ProviderError(`${role} request returned HTTP ${response.status}.`, {
      role,
      status: response.status,
      detail: raw.slice(0, 500),
    });
  }
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    throw new ProviderError(`${role} returned a body that is not JSON.`, {
      role,
      status: response.status,
      detail: raw.slice(0, 500),
    });
  }
  const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : null;
  if (!choice || !choice.message || typeof choice.message.content !== 'string') {
    throw new ProviderError(`${role} returned no choices[0].message.content.`, {
      role,
      status: response.status,
    });
  }
  const usage = normaliseUsage(parsed.usage);
  return {
    configured: true,
    role,
    id: typeof parsed.id === 'string' ? parsed.id : null,
    model: typeof parsed.model === 'string' ? parsed.model : config.model,
    content: choice.message.content,
    finishReason: choice.finish_reason ?? null,
    usage,
    latencyMs,
    cost: costOf(usage, config),
  };
}

/** Same as `chat`, then JSON.parse the content. The content stays untrusted data. */
export async function chatJson(options) {
  const result = await chat(options);
  let parsed;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new ProviderError(`${result.role} returned content that is not JSON.`, {
      role: result.role,
      detail: result.content.slice(0, 500),
    });
  }
  return { ...result, parsed };
}
