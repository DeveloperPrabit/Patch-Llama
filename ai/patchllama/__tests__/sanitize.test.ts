import { describe, expect, it } from 'vitest'
import { redactSecretText, redactSecrets, sanitizeErrorMessage } from '../storage/sanitize'
import { sanitizeExecution } from '../storage/session-mapper'

describe('redactSecretText', () => {
  it('redacts credentials embedded in ordinary multiline logs', () => {
    const log = [
      'Running tests...',
      'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'DATABASE_URL=postgresql://neondb_owner:hunter2@ep-x.neon.tech/neondb?sslmode=require',
      'MODEL_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345',
      'Expected 2 assertions to pass',
      'FAIL src/math.test.ts',
    ].join('\n')
    const out = redactSecretText(log)
    expect(out).toContain('Running tests...')
    expect(out).toContain('Expected 2 assertions to pass')
    expect(out).toContain('FAIL src/math.test.ts')
    expect(out).not.toMatch(/ghp_/)
    expect(out).not.toMatch(/hunter2/)
    expect(out).not.toMatch(/postgresql:\/\//)
    expect(out).not.toMatch(/sk-abcdefgh/)
    expect(out).toMatch(/\[redacted/)
  })

  it('redacts URLs with userinfo and PEM blocks', () => {
    const pem = `-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----`
    const out = redactSecretText(`clone https://user:tokensecret@github.com/org/repo.git\n${pem}`)
    expect(out).not.toContain('tokensecret')
    expect(out).not.toContain('BEGIN PRIVATE KEY')
    expect(out).toContain('[redacted')
  })

  it('preserves normal diagnostic output without secrets', () => {
    const log = 'AssertionError: expected 3 to be 4\n  at Object.<anonymous> (src/math.test.ts:12:20)'
    expect(redactSecretText(log)).toBe(log)
  })
})

describe('redactSecrets / sanitizeErrorMessage', () => {
  it('redacts secret keys and nested postgres URLs', () => {
    const out = redactSecrets({
      MODEL_API_KEY: 'secret',
      nested: { access_token: 'tok', note: 'ok' },
      url: 'postgresql://user:pass@host/db',
      stack: 'Error: connect postgresql://u:p@h/db failed',
    })
    expect(out.MODEL_API_KEY).toBe('[redacted]')
    expect(out.nested.access_token).toBe('[redacted]')
    expect(out.nested.note).toBe('ok')
    expect(out.url).toBe('[redacted-db-url]')
    expect(out.stack).not.toMatch(/postgresql:\/\//)
  })

  it('sanitizes error messages for clients', () => {
    const msg = sanitizeErrorMessage(
      new Error('connect to postgresql://neondb_owner:secret@ep-x.neon.tech/neondb failed')
    )
    expect(msg).not.toMatch(/postgresql:\/\//)
    expect(msg).not.toMatch(/secret/)
  })
})

describe('sanitizeExecution', () => {
  it('redacts stdout/stderr while keeping command and exit code', () => {
    const safe = sanitizeExecution({
      id: 'ex1',
      createdAt: new Date().toISOString(),
      kind: 'verify',
      command: 'bun test',
      exitCode: 1,
      durationMs: 12,
      stdout: 'ok',
      stderr: 'token ghp_abcdefghijklmnopqrstuvwxyz0123456789 leaked',
      timedOut: false,
      ok: false,
    })
    expect(safe.command).toBe('bun test')
    expect(safe.exitCode).toBe(1)
    expect(safe.stdout).toBe('ok')
    expect(safe.stderr).not.toMatch(/ghp_/)
  })
})
