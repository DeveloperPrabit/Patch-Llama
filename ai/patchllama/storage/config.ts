/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Storage backend selection — Postgres mandatory in production; JSON only when explicit local/demo.
 */

import { isExplicitDemoMode, isProduction } from '@/lib/auth-config'
import { StorageConfigError } from './errors'

export type StorageMode = 'postgres' | 'json'

export type StorageConfigInput = {
  nodeEnv?: string
  patchllamaStorage?: string
  databaseUrl?: string
  authDemoLogin?: string
  patchllamaMode?: string
}

export function resolveStorageMode(env: StorageConfigInput = processEnv()): StorageMode {
  const explicit = (env.patchllamaStorage || '').trim().toLowerCase()
  const production = isProduction({ nodeEnv: env.nodeEnv })
  const hasDb = Boolean((env.databaseUrl || '').trim())

  if (production) {
    if (explicit === 'json') {
      throw new StorageConfigError(
        'STORAGE_JSON_FORBIDDEN',
        'PATCHLLAMA_STORAGE=json is not allowed in production. Use PostgreSQL (Neon) with DATABASE_URL.'
      )
    }
    if (explicit && explicit !== 'postgres') {
      throw new StorageConfigError(
        'STORAGE_MODE_INVALID',
        `Unknown PATCHLLAMA_STORAGE="${explicit}". Use postgres (required in production).`
      )
    }
    if (!hasDb) {
      throw new StorageConfigError(
        'DATABASE_URL_REQUIRED',
        'Production requires DATABASE_URL (Neon PostgreSQL). Refusing to fall back to JSON storage.'
      )
    }
    return 'postgres'
  }

  if (explicit === 'postgres') {
    if (!hasDb) {
      throw new StorageConfigError(
        'DATABASE_URL_REQUIRED',
        'PATCHLLAMA_STORAGE=postgres requires DATABASE_URL.'
      )
    }
    return 'postgres'
  }

  if (explicit === 'json' || !explicit) {
    // Default local/dev/test: JSON. Hosted non-production can still opt into postgres.
    return 'json'
  }

  throw new StorageConfigError(
    'STORAGE_MODE_INVALID',
    `Unknown PATCHLLAMA_STORAGE="${explicit}". Use postgres or json.`
  )
}

/** True when JSON is an intentional local/demo choice (not a silent fallback). */
export function isJsonStorageAllowed(env: StorageConfigInput = processEnv()): boolean {
  if (isProduction({ nodeEnv: env.nodeEnv })) return false
  const mode = resolveStorageMode(env)
  return mode === 'json'
}

export function assertStorageConfig(env: StorageConfigInput = processEnv()): StorageMode {
  return resolveStorageMode(env)
}

/**
 * Prefer postgres when DATABASE_URL is set and operator did not force json,
 * except that production always requires postgres (handled above).
 * Demo/local with AUTH_DEMO_LOGIN may keep json unless PATCHLLAMA_STORAGE=postgres.
 */
export function recommendHostedStorage(env: StorageConfigInput = processEnv()): StorageMode {
  const explicit = (env.patchllamaStorage || '').trim().toLowerCase()
  if (explicit === 'json' && isExplicitDemoMode({
    nodeEnv: env.nodeEnv,
    authDemoLogin: env.authDemoLogin,
    patchllamaMode: env.patchllamaMode,
  })) {
    return 'json'
  }
  return resolveStorageMode(env)
}

function processEnv(): StorageConfigInput {
  return {
    nodeEnv: process.env.NODE_ENV,
    patchllamaStorage: process.env.PATCHLLAMA_STORAGE,
    databaseUrl: process.env.DATABASE_URL,
    authDemoLogin: process.env.AUTH_DEMO_LOGIN,
    patchllamaMode: process.env.PATCHLLAMA_MODE,
  }
}
