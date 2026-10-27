/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Create a repair PR only after VERIFIED + explicit approval. Never pushes to the default branch.
 */

import { NextResponse } from 'next/server'
import { createVerifiedRepairPr } from '@/ai/github/pr'
import { githubFetch } from '@/ai/github/client'
import { loadOwnedSession, errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const Body = z.object({
  sessionId: z.string().min(8),
  baseBranch: z.string().min(1).max(200),
  confirm: z.literal(true),
})

export async function POST(request: Request) {
  try {
    const user = await requireAuthed(request, 'github-pr', 3)
    if (!user.githubAccessToken) {
      return NextResponse.json(
        { error: { code: 'github_auth_required', message: 'GitHub OAuth required' } },
        { status: 401 }
      )
    }
    const body = Body.parse(await readJsonLimited(request))
    const session = await loadOwnedSession(body.sessionId, user.id)

    // Validate repository + default branch from GitHub API (not client alone)
    const repoRes = await githubFetch(user.githubAccessToken, `/repos/${session.repoFullName}`)
    if (!repoRes.ok) {
      return NextResponse.json(
        { error: { code: 'repo_lookup_failed', message: `GitHub repo lookup failed (${repoRes.status})` } },
        { status: 400 }
      )
    }
    const repo = (await repoRes.json()) as { full_name?: string; default_branch?: string }
    if (!repo.full_name || repo.full_name.toLowerCase() !== session.repoFullName?.toLowerCase()) {
      return NextResponse.json(
        { error: { code: 'repo_mismatch', message: 'Session repository does not match GitHub' } },
        { status: 400 }
      )
    }
    if (body.baseBranch === repo.default_branch) {
      // Allowed as PR base; createVerifiedRepairPr refuses pushing head == base
    } else {
      // Ensure base branch exists
      const ref = await githubFetch(
        user.githubAccessToken,
        `/repos/${session.repoFullName}/git/ref/heads/${encodeURIComponent(body.baseBranch)}`
      )
      if (!ref.ok) {
        return NextResponse.json(
          { error: { code: 'base_branch_missing', message: `Base branch not found: ${body.baseBranch}` } },
          { status: 400 }
        )
      }
    }

    const result = await createVerifiedRepairPr({
      session,
      accessToken: user.githubAccessToken,
      baseBranch: body.baseBranch,
      defaultBranch: repo.default_branch,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}
