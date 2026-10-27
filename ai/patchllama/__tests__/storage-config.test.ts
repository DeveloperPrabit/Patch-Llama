import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveStorageMode,
  StorageConfigError,
} from '../storage'
import { resetSessionStoreCache } from '../storage'
import { safeStorageError } from '../storage/errors'

describe('storage config', () => {
  afterEach(() => {
    resetSessionStoreCache()
  })

  it('defaults to json outside production when unset', () => {
    expect(
      resolveStorageMode({
        nodeEnv: 'development',
        patchllamaStorage: undefined,
        databaseUrl: undefined,
      })
    ).toBe('json')
  })

  it('allows explicit json in local/demo', () => {
    expect(
      resolveStorageMode({
        nodeEnv: 'test',
        patchllamaStorage: 'json',
      })
    ).toBe('json')
  })

  it('requires DATABASE_URL for explicit postgres', () => {
    expect(() =>
      resolveStorageMode({
        nodeEnv: 'development',
        patchllamaStorage: 'postgres',
        databaseUrl: '',
      })
    ).toThrow(StorageConfigError)
  })

  it('production refuses json and refuses missing DATABASE_URL', () => {
    expect(() =>
      resolveStorageMode({
        nodeEnv: 'production',
        patchllamaStorage: 'json',
        databaseUrl: 'postgresql://example/db',
      })
    ).toThrow(/not allowed in production/)

    expect(() =>
      resolveStorageMode({
        nodeEnv: 'production',
        patchllamaStorage: undefined,
        databaseUrl: '',
      })
    ).toThrow(/Refusing to fall back to JSON/)
  })

  it('production defaults to postgres when DATABASE_URL is set', () => {
    expect(
      resolveStorageMode({
        nodeEnv: 'production',
        databaseUrl: 'postgresql://example/neondb?sslmode=require',
      })
    ).toBe('postgres')
  })

  it('safeStorageError redacts connection strings', () => {
    const err = safeStorageError(
      new Error('connect to postgresql://neondb_owner:secret@ep-x.neon.tech/neondb failed')
    )
    expect(err.message).not.toMatch(/postgresql:\/\//)
    expect(err.message).not.toMatch(/secret/)
  })
})
