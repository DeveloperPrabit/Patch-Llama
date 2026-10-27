/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Create a repair PR only after VERIFIED + explicit approval. Never pushes to default branch.
 */

import { NextResponse } from 'next/server'
import { createRepairPullRequest } from '@/ai/github/client'
import { loadOwnedSession, errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'
import { spawn } from 'node:child_process'

export const runtime = 'nodejs'

const Body = z.object({
  sessionId: z.string().min(8),
  baseBranch: z.string().min(1).max(200),
  confirm: z.literal(true),
})

function run(cwd: string, args: string[]) {
  return new Promise<{ exitCode: number; stderr: string }>((resolve) => {
    const child = spawn('git', args, { cwd, shell: false, windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (c) => (stderr += String(c)))
    child.on('close', (code) => resolve({ exitCode: code ?? 1, stderr }))
  })
}

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
    if (session.status !== 'verified') {
      return NextResponse.json(
        { error: { code: 'not_verified', message: 'PR requires VERIFIED session' } },
        { status: 400 }
      )
    }
    if (!session.repoFullName || !session.commitSha) {
      return NextResponse.json(
        { error: { code: 'not_github', message: 'Session is not a GitHub project' } },
        { status: 400 }
      )
    }

    const branch = `patchllama/fix-${session.id.slice(0, 12)}`
    const cwd = session.workspaceRoot
    // Re-add origin without logging token
    const remote = `https://x-access-token:${user.githubAccessToken}@github.com/${session.repoFullName}.git`
    await run(cwd, ['remote', 'remove', 'origin']).catch(() => undefined)
    const add = await run(cwd, ['remote', 'add', 'origin', remote])
    if (add.exitCode !== 0) throw new Error(add.stderr)
    const checkout = await run(cwd, ['checkout', '-b', branch])
    if (checkout.exitCode !== 0) throw new Error(checkout.stderr)
    await run(cwd, ['add', '-A'])
    await run(cwd, ['commit', '-m', `fix: PatchLlama repair for ${session.intake.title}`])
    const push = await run(cwd, ['push', '-u', 'origin', branch])
    // Scrub remote immediately
    await run(cwd, ['remote', 'remove', 'origin'])
    if (push.exitCode !== 0) throw new Error(`push failed: ${push.stderr.slice(0, 300)}`)

    const pr = await createRepairPullRequest({
      accessToken: user.githubAccessToken,
      fullName: session.repoFullName,
      baseBranch: body.baseBranch,
      headBranch: branch,
      title: `PatchLlama: ${session.intake.title}`,
      body: [
        'Automated repair branch created by PatchLlama after **VERIFIED** checks.',
        '',
        `- Session: \`${session.id}\``,
        `- Base commit: \`${session.commitSha}\``,
        `- Evidence: \`${session.evidenceSource}\``,
        '',
        'Do not merge without human review.',
      ].join('\n'),
    })

    return NextResponse.json({ ok: true, branch, pullRequest: pr })
  } catch (error) {
    return errorResponse(error)
  }
}
