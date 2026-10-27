import { describe, expect, it } from 'vitest'
import {
  evaluateAuthConfig,
  isAuthSecretStrong,
  isExplicitDemoMode,
} from '../auth-config'

const strong = 'a'.repeat(32)

describe('auth-config production fail-closed', () => {
  it('rejects missing/weak secret in production', () => {
    expect(
      evaluateAuthConfig({
        nodeEnv: 'production',
        authSecret: '',
        githubId: 'id',
        githubSecret: 'sec',
      }).ok
    ).toBe(false)
    expect(
      evaluateAuthConfig({
        nodeEnv: 'production',
        authSecret: 'dev-only-change-me',
        githubId: 'id',
        githubSecret: 'sec',
      }).ok
    ).toBe(false)
    expect(isAuthSecretStrong('short')).toBe(false)
  })

  it('rejects production without GitHub provider', () => {
    const r = evaluateAuthConfig({
      nodeEnv: 'production',
      authSecret: strong,
      authDemoLogin: '1',
      patchllamaMode: 'demo',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('AUTH_PROVIDER_REQUIRED')
  })

  it('accepts production with GitHub + strong secret', () => {
    const r = evaluateAuthConfig({
      nodeEnv: 'production',
      authSecret: strong,
      githubId: 'id',
      githubSecret: 'sec',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.allowDemoProvider).toBe(false)
  })
})

describe('demo login restrictions', () => {
  it('disables demo in production even with flags', () => {
    expect(
      isExplicitDemoMode({
        nodeEnv: 'production',
        authDemoLogin: '1',
        patchllamaMode: 'demo',
      })
    ).toBe(false)
  })

  it('requires both AUTH_DEMO_LOGIN and PATCHLLAMA_MODE=demo|local', () => {
    expect(
      isExplicitDemoMode({
        nodeEnv: 'development',
        authDemoLogin: '1',
        patchllamaMode: '',
      })
    ).toBe(false)
    expect(
      isExplicitDemoMode({
        nodeEnv: 'development',
        authDemoLogin: '1',
        patchllamaMode: 'demo',
      })
    ).toBe(true)
  })

  it('does not allow demo provider fallback when github missing without explicit mode', () => {
    const r = evaluateAuthConfig({
      nodeEnv: 'development',
      authSecret: strong,
    })
    expect(r.ok).toBe(false)
  })
})
