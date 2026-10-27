import { describe, expect, it } from 'vitest'
import { assertSandboxEnvSafe, sandboxEnv } from '../docker-executor'

describe('environment isolation', () => {
  it('sandbox env does not include model or auth secrets', () => {
    const env = sandboxEnv()
    expect(env.some((e) => e.startsWith('MODEL_'))).toBe(false)
    expect(env.some((e) => e.includes('API_KEY'))).toBe(false)
    expect(() => assertSandboxEnvSafe(env)).not.toThrow()
    expect(() => assertSandboxEnvSafe([...env, 'MODEL_API_KEY=secret'])).toThrow(/Forbidden/)
  })
})
