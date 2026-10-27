import { describe, expect, it } from 'vitest'
import { redactSecrets, runGit } from '../git-credential'

describe('git credential safety', () => {
  it('redacts tokens from error text', () => {
    expect(redactSecrets('https://x-access-token:gho_abc@github.com/a/b')).toContain('[REDACTED]')
    expect(redactSecrets('Authorization: Bearer ghp_secretvalue')).toContain('[REDACTED]')
  })

  it('refuses git argv containing token material', async () => {
    const r = await runGit(
      ['clone', 'https://x-access-token:SECRET@github.com/a/b.git'],
      process.cwd()
    )
    expect(r.exitCode).toBe(1)
    expect(r.stderr).toMatch(/refusing/i)
  })
})
