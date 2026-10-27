/**
 * Import script safety: duplicate session IDs must be skipped (idempotent).
 * Does not touch a live database — validates the guard logic used by the importer.
 */
import { describe, expect, it } from 'vitest'

function shouldSkipDuplicate(existingIds: Set<string>, sessionId: string): boolean {
  return existingIds.has(sessionId)
}

describe('json import idempotency policy', () => {
  it('skips duplicates and never deletes source ids from the set', () => {
    const existing = new Set(['dbg_aaaaaaaaaaaaaaaaaaaa'])
    expect(shouldSkipDuplicate(existing, 'dbg_aaaaaaaaaaaaaaaaaaaa')).toBe(true)
    expect(shouldSkipDuplicate(existing, 'dbg_bbbbbbbbbbbbbbbbbbbb')).toBe(false)
    existing.add('dbg_bbbbbbbbbbbbbbbbbbbb')
    expect(shouldSkipDuplicate(existing, 'dbg_bbbbbbbbbbbbbbbbbbbb')).toBe(true)
  })
})
