/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NextResponse } from 'next/server'
import { approvePatch } from '@/ai/patchllama/pipeline'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const Body = z.object({ decision: z.enum(['approve', 'reject']) })

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; patchId: string }> }
) {
  try {
    const { id, patchId } = await context.params
    const body = Body.parse(await request.json())
    const session = await approvePatch(id, patchId, body.decision)
    return NextResponse.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: { code: 'approve_failed', message } }, { status: 400 })
  }
}
