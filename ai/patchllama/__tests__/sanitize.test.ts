import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../storage/sanitize'

describe('redactSecrets', () => {
  it('redacts credential-like keys and postgres URLs', () => {
    const out = redactSecrets({
      MODEL_API_KEY: 'secret',
      nested: { access_token: 'tok', note: 'ok' },
      url: 'postgresql://user:pass@host/db',
    })
    expect(out.MODEL_API_KEY).toBe('[redacted]')
    expect(out.nested.access_token).toBe('[redacted]')
    expect(out.nested.note).toBe('ok')
    expect(out.url).toBe('[redacted-db-url]')
  })
})
