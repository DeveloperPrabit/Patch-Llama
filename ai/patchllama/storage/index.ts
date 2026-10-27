/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { resolveStorageMode, type StorageMode } from './config'
import { createJsonStore } from './json-store'
import type { SessionStore } from './types'

let cached: { mode: StorageMode; store: SessionStore } | null = null

/** Reset cached store (tests). */
export function resetSessionStoreCache(): void {
  cached = null
}

export function getSessionStore(): SessionStore {
  const mode = resolveStorageMode()
  if (cached && cached.mode === mode) return cached.store

  if (mode === 'postgres') {
    // Lazy load so JSON-mode unit tests never touch the DB client / server-only.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPostgresStore } = require('./postgres-store') as typeof import('./postgres-store')
    cached = { mode, store: createPostgresStore() }
  } else {
    cached = { mode, store: createJsonStore() }
  }
  return cached.store
}

export function getActiveStorageMode(): StorageMode {
  return resolveStorageMode()
}

export type { SessionStore, CreateSessionInput } from './types'
export {
  resolveStorageMode,
  assertStorageConfig,
  isJsonStorageAllowed,
  type StorageMode,
  type StorageConfigInput,
} from './config'
export {
  StorageConfigError,
  VersionConflictError,
  StorageUnavailableError,
  safeStorageError,
} from './errors'
export { createJsonStore } from './json-store'
export { redactSecrets } from './sanitize'
