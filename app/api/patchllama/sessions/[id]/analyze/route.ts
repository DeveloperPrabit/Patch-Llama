import { NextResponse } from 'next/server'
import { analyzeSession, runBaseline } from '@/ai/patchllama/pipeline'
import { errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const Body = z.object({
  runBaseline: z.boolean().default(true),
})

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthed(request, 'analyze', 8, 60_000)
    const { id } = await ctx.params
    const body = Body.parse(await readJsonLimited(request).catch(() => ({})))
    let session
    if (body.runBaseline) {
      session = await runBaseline(id, user.id)
      if (session.status === 'inconclusive') {
        return NextResponse.json({ session, status: 'INCONCLUSIVE' })
      }
    }
    session = await analyzeSession(id, user.id)
    return NextResponse.json({ session })
  } catch (error) {
    return errorResponse(error)
  }
}
