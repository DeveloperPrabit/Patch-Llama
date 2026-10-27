/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama — Meta Muse Spark chat completions client.
 *
 * Uses the documented OpenAI-compatible protocol against api.meta.ai.
 * Never falls back to OpenAI, Claude, Gemini, or any other provider.
 */

import { getMuseSparkConfig, type MuseSparkConfig } from './config'

export class MuseSparkError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_configured'
      | 'unauthorized'
      | 'rate_limited'
      | 'timeout'
      | 'invalid_response'
      | 'provider_error'
      | 'bad_request',
    readonly status?: number
  ) {
    super(message)
    this.name = 'MuseSparkError'
  }
}

export type ChatMessage = {
  role: 'developer' | 'system' | 'user' | 'assistant'
  content: string
}

export type StructuredChatOptions = {
  messages: ChatMessage[]
  schemaName: string
  jsonSchema: Record<string, unknown>
  maxRetries?: number
}

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function postChat(
  config: MuseSparkConfig,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> {
  try {
    return await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: withTimeout(config.timeoutSeconds * 1000, signal),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new MuseSparkError('Meta Model API request timed out', 'timeout')
    }
    throw new MuseSparkError('Meta Model API unreachable', 'provider_error')
  }
}

function mapHttpError(status: number, text: string): MuseSparkError {
  if (status === 401 || status === 403) {
    return new MuseSparkError('Meta Model API authentication failed', 'unauthorized', status)
  }
  if (status === 429) {
    return new MuseSparkError('Meta Model API rate limit exceeded', 'rate_limited', status)
  }
  if (status >= 400 && status < 500) {
    return new MuseSparkError(
      `Meta Model API rejected the request (${status})`,
      'bad_request',
      status
    )
  }
  return new MuseSparkError(
    `Meta Model API error (${status}): ${text.slice(0, 200)}`,
    'provider_error',
    status
  )
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new MuseSparkError('Empty Meta Model API response', 'invalid_response')
  }
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    throw new MuseSparkError('Meta response missing choices', 'invalid_response')
  }
  const message = (choices[0] as { message?: { content?: unknown } }).message
  const content = message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new MuseSparkError('Meta response missing message content', 'invalid_response')
  }
  return content
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced?.[1]?.trim() || trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    throw new MuseSparkError('Model returned non-JSON content', 'invalid_response')
  }
}

export type MuseSparkClient = {
  configured: true
  model: string
  chatJson<T>(
    options: StructuredChatOptions,
    parse: (raw: unknown) => T,
    signal?: AbortSignal
  ): Promise<{ data: T; usage?: { prompt_tokens?: number; completion_tokens?: number } }>
  ping(signal?: AbortSignal): Promise<{ ok: true; model: string; preview: string }>
}

export function createMuseSparkClient(config?: MuseSparkConfig | null): MuseSparkClient | null {
  const resolved = config ?? getMuseSparkConfig()
  if (!resolved) return null

  return {
    configured: true,
    model: resolved.model,

    async chatJson(options, parse, signal) {
      const maxRetries = options.maxRetries ?? 1
      let lastError: MuseSparkError | undefined
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await postChat(
          resolved,
          {
            model: resolved.model,
            messages: options.messages,
            max_completion_tokens: resolved.maxOutputTokens,
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: options.schemaName,
                strict: true,
                schema: options.jsonSchema,
              },
            },
          },
          signal
        )
        if (response.ok) {
          const payload = (await response.json()) as {
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }
          const content = extractContent(payload)
          const raw = parseJsonObject(content)
          return { data: parse(raw), usage: payload.usage }
        }
        const text = await response.text().catch(() => '')
        lastError = mapHttpError(response.status, text)
        const retryable =
          lastError.code === 'rate_limited' || lastError.code === 'provider_error'
        if (!retryable || attempt === maxRetries) throw lastError
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
      throw lastError ?? new MuseSparkError('Meta Model API failed', 'provider_error')
    },

    async ping(signal) {
      // Muse Spark always reasons; max_completion_tokens includes reasoning tokens,
      // so a tiny budget can yield empty visible content even on a healthy key.
      const response = await postChat(
        resolved,
        {
          model: resolved.model,
          messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
          max_completion_tokens: 256,
          reasoning_effort: 'low',
        },
        signal
      )
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw mapHttpError(response.status, text)
      }
      const payload = await response.json()
      const preview = extractContent(payload).slice(0, 80)
      return { ok: true as const, model: resolved.model, preview }
    },
  }
}
