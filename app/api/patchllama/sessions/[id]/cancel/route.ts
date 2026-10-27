import { NextResponse } from 'next/server'
import { cancelSession } from '@/ai/patchllama/pipeline'
import { errorResponse, requireAuthed } from '@/lib/api'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthed(request, 'cancel', 30)
    const { id } = await ctx.params
    const session = await cancelSession(id, user.id)
    return NextResponse.json({ session })
  } catch (error) {
    return errorResponse(error)
  }
}
