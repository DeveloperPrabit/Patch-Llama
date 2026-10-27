/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Pure auth configuration policy (unit-testable, no NextAuth side effects).
 */

export type AuthConfigInput = {
  nodeEnv?: string
  authSecret?: string
  nextAuthSecret?: string
  githubId?: string
  githubSecret?: string
  authDemoLogin?: string
  patchllamaMode?: string
}

export function isProduction(env: AuthConfigInput = processEnv()): boolean {
  return (env.nodeEnv || 'development') === 'production'
}

export function isExplicitDemoMode(env: AuthConfigInput = processEnv()): boolean {
  if (isProduction(env)) return false
  const mode = (env.patchllamaMode || '').trim().toLowerCase()
  const demoFlag = env.authDemoLogin === '1' || env.authDemoLogin === 'true'
  return demoFlag && (mode === 'demo' || mode === 'local')
}

export function resolveAuthSecret(env: AuthConfigInput = processEnv()): string | null {
  const secret = (env.authSecret || env.nextAuthSecret || '').trim()
  return secret || null
}

export function isAuthSecretStrong(secret: string | null): boolean {
  if (!secret) return false
  if (secret === 'dev-only-change-me') return false
  if (secret.length < 32) return false
  return true
}

export function hasGithubProvider(env: AuthConfigInput = processEnv()): boolean {
  return Boolean(env.githubId?.trim() && env.githubSecret?.trim())
}

export type AuthConfigResult =
  | { ok: true; allowDemoProvider: boolean; hasGithub: boolean; secret: string }
  | { ok: false; code: string; message: string }

/**
 * Fail closed in production without strong AUTH_SECRET and an approved provider (GitHub).
 * Demo credentials provider is only allowed in explicit local/demo mode (never production).
 */
export function evaluateAuthConfig(env: AuthConfigInput = processEnv()): AuthConfigResult {
  const secret = resolveAuthSecret(env)
  const production = isProduction(env)
  const hasGithub = hasGithubProvider(env)
  const allowDemoProvider = isExplicitDemoMode(env)

  if (production) {
    if (!isAuthSecretStrong(secret)) {
      return {
        ok: false,
        code: 'AUTH_SECRET_REQUIRED',
        message:
          'Production requires AUTH_SECRET (or NEXTAUTH_SECRET) of at least 32 characters; weak/default secrets are rejected.',
      }
    }
    if (!hasGithub) {
      return {
        ok: false,
        code: 'AUTH_PROVIDER_REQUIRED',
        message:
          'Production requires GitHub OAuth (AUTH_GITHUB_ID + AUTH_GITHUB_SECRET). Demo login is disabled in production.',
      }
    }
    return { ok: true, allowDemoProvider: false, hasGithub: true, secret: secret! }
  }

  // Non-production: still reject empty secret for Auth.js boot, but allow a generated warning path
  if (!secret) {
    return {
      ok: false,
      code: 'AUTH_SECRET_REQUIRED',
      message: 'AUTH_SECRET is required even in development. Set a >=32 character secret in .env.',
    }
  }
  if (!isAuthSecretStrong(secret)) {
    return {
      ok: false,
      code: 'AUTH_SECRET_WEAK',
      message: 'AUTH_SECRET must be at least 32 characters and must not be the placeholder value.',
    }
  }
  if (!hasGithub && !allowDemoProvider) {
    return {
      ok: false,
      code: 'AUTH_PROVIDER_REQUIRED',
      message:
        'Configure AUTH_GITHUB_ID/SECRET, or set PATCHLLAMA_MODE=demo|local and AUTH_DEMO_LOGIN=1 for local demo auth.',
    }
  }
  return {
    ok: true,
    allowDemoProvider,
    hasGithub,
    secret,
  }
}

export function assertAuthConfig(env: AuthConfigInput = processEnv()): asserts env is AuthConfigInput {
  const result = evaluateAuthConfig(env)
  if (!result.ok) {
    const err = new Error(result.message)
    ;(err as Error & { status: number; code: string }).status = 503
    ;(err as Error & { code: string }).code = result.code
    throw err
  }
}

function processEnv(): AuthConfigInput {
  return {
    nodeEnv: process.env.NODE_ENV,
    authSecret: process.env.AUTH_SECRET,
    nextAuthSecret: process.env.NEXTAUTH_SECRET,
    githubId: process.env.AUTH_GITHUB_ID,
    githubSecret: process.env.AUTH_GITHUB_SECRET,
    authDemoLogin: process.env.AUTH_DEMO_LOGIN,
    patchllamaMode: process.env.PATCHLLAMA_MODE,
  }
}
