/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama — Meta Muse Spark configuration (server-side only).
 *
 * Official Meta Model API: https://dev.meta.ai/docs/overview
 * Chat Completions: POST {base}/chat/completions with Bearer MODEL_API_KEY
 */

export type MuseSparkConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutSeconds: number
  maxOutputTokens: number
}

const DEFAULT_BASE = 'https://api.meta.ai/v1'
const DEFAULT_MODEL = 'muse-spark-1.3'
const DEFAULT_TIMEOUT = 60
const DEFAULT_MAX_TOKENS = 4096

function flag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

/** True when MODEL_API_KEY is set — real Muse Spark calls. */
export function isMuseSparkConfigured(): boolean {
  return Boolean(process.env.MODEL_API_KEY?.trim())
}

/**
 * Demo/mock mode when the Meta key is absent.
 * UI must label responses as demo — never as Muse Spark.
 */
export function isPatchllamaDemoMode(): boolean {
  if (flag('PATCHLLAMA_DEMO_MODE')) return true
  return !isMuseSparkConfigured()
}

export function getMuseSparkConfig(): MuseSparkConfig | null {
  const apiKey = process.env.MODEL_API_KEY?.trim()
  if (!apiKey) return null
  const timeout = Number(process.env.MODEL_TIMEOUT_SECONDS)
  const maxTokens = Number(process.env.MODEL_MAX_OUTPUT_TOKENS)
  return {
    apiKey,
    baseUrl: (process.env.MODEL_API_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, ''),
    model: process.env.MODEL_NAME?.trim() || DEFAULT_MODEL,
    timeoutSeconds: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT,
    maxOutputTokens:
      Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS,
  }
}

export function getMaxRepairAttempts(): number {
  const n = Number(process.env.PATCHLLAMA_MAX_REPAIR_ATTEMPTS)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.floor(n) : 2
}
