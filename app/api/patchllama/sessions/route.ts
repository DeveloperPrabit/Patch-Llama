/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * GET/POST /api/patchllama/sessions — authenticated; identity from server session.
 */

import { NextResponse } from 'next/server'
import { startDebugSession } from '@/ai/patchllama/pipeline'
import { listSessionsForUser } from '@/ai/patchllama/store'
import { createManagedWorkspace, writeWorkspaceFiles } from '@/ai/patchllama/workspace-manager'
import { errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const CreateBody = z.object({
  projectId: z.string().default('local'),
  intake: z.object({
    title: z.string().min(1).max(200),
    failureType: z.enum(['build', 'test', 'typecheck', 'runtime', 'lint', 'other']),
    command: z.string().min(1).max(500),
    exitCode: z.number().int(),
    stdout: z.string().max(100_000).default(''),
    stderr: z.string().max(100_000).default(''),
    stack: z.string().max(50_000).optional(),
    expected: z.string().max(2000).optional(),
    actual: z.string().max(2000).optional(),
    reproductionSteps: z.string().max(5000).optional(),
    relevantPaths: z.array(z.string()).max(50).default([]),
  }),
  files: z
    .array(z.object({ path: z.string(), content: z.string().max(400_000) }))
    .min(1)
    .max(40),
})
// Note: client-supplied userId / workspaceRoot are ignored; identity comes from auth().

export async function GET(request: Request) {
  try {
    const user = await requireAuthed(request, 'sessions-list', 60)
    const sessions = await listSessionsForUser(user.id, 40)
    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.intake.title,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        evidenceSource: s.evidenceSource,
        verified: s.status === 'verified',
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthed(request, 'sessions-create', 20)
    const body = CreateBody.parse(await readJsonLimited(request))
    const ws = await createManagedWorkspace('sess')
    await writeWorkspaceFiles(ws.root, body.files)
    const session = await startDebugSession({
      projectId: body.projectId,
      organizationId: user.id,
      userId: user.id,
      intake: body.intake,
      files: body.files,
      workspaceRoot: ws.root,
      workspaceId: ws.id,
      evidenceSource: 'seeded_fixture',
    })
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
