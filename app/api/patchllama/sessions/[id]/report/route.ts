import { NextResponse } from 'next/server'
import { sessionReport } from '@/ai/patchllama/pipeline'
import { errorResponse, requireAuthed } from '@/lib/api'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthed(request, 'report', 60)
    const { id } = await ctx.params
    const report = await sessionReport(id, user.id)
    return NextResponse.json({ report })
  } catch (error) {
    return errorResponse(error)
  }
}
