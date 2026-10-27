/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * GET/POST /api/patchllama/sessions
 */

import { NextResponse } from 'next/server'
import { startDebugSession } from '@/ai/patchllama/pipeline'
import { listSessions } from '@/ai/patchllama/store'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const CreateBody = z.object({
  projectId: z.string().default('local'),
  organizationId: z.string().default('local'),
  userId: z.string().default('local'),
  workspaceRoot: z.string().min(1),
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

export async function GET() {
  const sessions = await listSessions(40)
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.intake.title,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      verified: s.status === 'verified',
    })),
  })
}

export async function POST(request: Request) {
  try {
    const body = CreateBody.parse(await request.json())
    const session = await startDebugSession(body)
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: { code: 'invalid_request', message } }, { status: 400 })
  }
}
