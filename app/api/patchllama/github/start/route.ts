/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Start a real-project session from a GitHub repo @ pinned commit SHA.
 */

import { NextResponse } from 'next/server'
import { resolveCommitSha } from '@/ai/github/client'
import { cloneRepoAtSha } from '@/ai/github/clone'
import { runBaseline, startDebugSession } from '@/ai/patchllama/pipeline'
import { errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

const Body = z.object({
  fullName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  branch: z.string().min(1).max(200),
  failureType: z.enum(['build', 'test', 'typecheck']).default('test'),
  title: z.string().min(1).max(200).default('GitHub project failure'),
})

async function collectSourceFiles(root: string, limit = 25): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = []
  async function walk(dir: string, rel = '') {
    if (out.length >= limit) return
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (out.length >= limit) return
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(abs, nextRel)
      } else if (/\.(ts|tsx|js|jsx|json|py|go|rs|md)$/.test(entry.name)) {
        const st = await stat(abs)
        if (st.size > 200_000) continue
        out.push({ path: nextRel.replace(/\\/g, '/'), content: await readFile(abs, 'utf8') })
      }
    }
  }
  await walk(root)
  return out
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthed(request, 'github-start', 5)
    if (!user.githubAccessToken) {
      return NextResponse.json(
        {
          error: {
            code: 'github_auth_required',
            message: 'Sign in with GitHub OAuth (AUTH_GITHUB_ID/SECRET) to start real-project sessions.',
          },
        },
        { status: 401 }
      )
    }
    const body = Body.parse(await readJsonLimited(request))
    const sha = await resolveCommitSha(user.githubAccessToken, body.fullName, body.branch)
    const cloned = await cloneRepoAtSha({
      accessToken: user.githubAccessToken,
      fullName: body.fullName,
      commitSha: sha,
    })
    const files = await collectSourceFiles(cloned.workspaceRoot)
    const session = await startDebugSession({
      projectId: `gh:${body.fullName}`,
      organizationId: user.id,
      userId: user.id,
      intake: {
        title: body.title,
        failureType: body.failureType,
        command: `bun run ${body.failureType === 'test' ? 'test' : body.failureType}`,
        exitCode: 1,
        stdout: '',
        stderr: 'Pending baseline execution in Docker',
        relevantPaths: files.slice(0, 10).map((f) => f.path),
      },
      files,
      workspaceRoot: cloned.workspaceRoot,
      workspaceId: cloned.workspaceId,
      evidenceSource: 'seeded_fixture',
      commitSha: cloned.commitSha,
      repoFullName: body.fullName,
    })
    const withBaseline = await runBaseline(session.id, user.id)
    return NextResponse.json({ session: withBaseline, commitSha: cloned.commitSha }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
