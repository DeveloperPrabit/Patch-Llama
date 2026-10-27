/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Auth.js (NextAuth) — GitHub OAuth + optional local demo login.
 * Identity always comes from the verified server session, never request body.
 */

import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'

const providers = []

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      // Least privilege for repo listing/clone/PR is requested later via Octokit token scopes.
      authorization: { params: { scope: 'read:user user:email repo' } },
    })
  )
}

/** Local/demo only — never trust a client-supplied userId; this creates a fixed demo principal. */
if (process.env.AUTH_DEMO_LOGIN === '1' || process.env.AUTH_DEMO_LOGIN === 'true') {
  providers.push(
    Credentials({
      id: 'demo',
      name: 'Demo',
      credentials: {},
      async authorize() {
        return {
          id: 'demo-user',
          name: 'PatchLlama Demo',
          email: 'demo@patchllama.local',
        }
      },
    })
  )
}

if (providers.length === 0) {
  // Ensure Auth.js can boot in CI: demo credentials when no OAuth configured.
  providers.push(
    Credentials({
      id: 'demo',
      name: 'Demo',
      credentials: {},
      async authorize() {
        return {
          id: 'demo-user',
          name: 'PatchLlama Demo',
          email: 'demo@patchllama.local',
        }
      },
    })
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-change-me',
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
