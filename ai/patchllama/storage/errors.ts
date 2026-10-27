/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class StorageConfigError extends Error {
  status = 503
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'StorageConfigError'
    this.code = code
  }
}

export class VersionConflictError extends Error {
  status = 409
  code = 'VERSION_CONFLICT'
  constructor(message = 'Session was updated concurrently; reload and retry') {
    super(message)
    this.name = 'VersionConflictError'
  }
}

export class StorageUnavailableError extends Error {
  status = 503
  code = 'STORAGE_UNAVAILABLE'
  constructor(message = 'Database temporarily unavailable') {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

/** Strip credential-like values from error messages before returning to clients. */
export function safeStorageError(error: unknown): Error {
  if (error instanceof StorageConfigError || error instanceof VersionConflictError) {
    return error
  }
  const raw = error instanceof Error ? error.message : String(error)
  const scrubbed = raw
    .replace(/postgres(?:ql)?:\/\/[^\s)'"]+/gi, '[redacted-db-url]')
    .replace(/npg_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/password=[^&\s]+/gi, 'password=[redacted]')
  const err = new StorageUnavailableError(
    scrubbed.includes('[redacted')
      ? 'Database operation failed'
      : scrubbed.slice(0, 200) || 'Database operation failed'
  )
  return err
}
