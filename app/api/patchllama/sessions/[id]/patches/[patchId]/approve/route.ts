import { NextResponse } from 'next/server'
import { approvePatch } from '@/ai/patchllama/pipeline'
import { IsolationUnavailableError } from '@/ai/patchllama/docker-executor'
import { errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const Body = z.object({
  decision: z.enum(['approve', 'reject']),
})

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; patchId: string }> }
) {
  try {
    const user = await requireAuthed(request, 'approve', 10)
    const { id, patchId } = await ctx.params
    const body = Body.parse(await readJsonLimited(request))
    const session = await approvePatch(id, patchId, body.decision, user.id)
    return NextResponse.json({ session })
  } catch (error) {
    if (error instanceof IsolationUnavailableError) {
      ;(error as Error & { status: number; code: string }).status = 503
      ;(error as Error & { code: string }).code = 'ISOLATION_UNAVAILABLE'
    }
    return errorResponse(error)
  }
}
