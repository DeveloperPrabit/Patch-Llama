/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Auth.js (NextAuth) — GitHub OAuth + optional explicit local/demo login.
 * Identity always comes from the verified server session, never request body.
 */

import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { evaluateAuthConfig, isExplicitDemoMode } from '@/lib/auth-config'
import type { Provider } from 'next-auth/providers'

function buildProviders(): Provider[] {
  const cfg = evaluateAuthConfig()
  if (!cfg.ok) {
    // Defer throw to request time via assert in handlers/requireUser,
    // but do not silently install a demo provider.
    return []
  }
  const providers: Provider[] = []
  if (cfg.hasGithub) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID!,
        clientSecret: process.env.AUTH_GITHUB_SECRET!,
        // Minimum scopes for identity + private clone/PR create.
        // public_repo alone is insufficient for private repos.
        authorization: { params: { scope: 'read:user repo' } },
      })
    )
  }
  if (cfg.allowDemoProvider) {
    providers.push(
      Credentials({
        id: 'demo',
        name: 'Demo',
        credentials: {},
        async authorize() {
          if (!isExplicitDemoMode()) return null
          return {
            id: 'demo-user',
            name: 'PatchLlama Demo',
            email: 'demo@patchllama.local',
          }
        },
      })
    )
  }
  return providers
}

const authConfig = evaluateAuthConfig()
const secret = authConfig.ok ? authConfig.secret : 'invalid-unconfigured-secret'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: buildProviders(),
  session: { strategy: 'jwt' },
  secret,
  trustHost: true,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) token.sub = user.id
      if (account?.access_token) {
        token.githubAccessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) || 'unknown'
      }
      ;(session as { githubAccessToken?: string }).githubAccessToken = token.githubAccessToken as
        | string
        | undefined
      return session
    },
  },
})

export type AppUser = {
  id: string
  name?: string | null
  email?: string | null
  githubAccessToken?: string
}

export async function requireUser(): Promise<AppUser> {
  const cfg = evaluateAuthConfig()
  if (!cfg.ok) {
    const err = new Error(cfg.message)
    ;(err as Error & { status: number; code: string }).status = 503
    ;(err as Error & { code: string }).code = cfg.code
    throw err
  }
  const session = await auth()
  if (!session?.user?.id) {
    const err = new Error('Authentication required')
    ;(err as Error & { status: number }).status = 401
    throw err
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    githubAccessToken: (session as { githubAccessToken?: string }).githubAccessToken,
  }
}

export function isDemoLoginEnabled(): boolean {
  return isExplicitDemoMode()
}
