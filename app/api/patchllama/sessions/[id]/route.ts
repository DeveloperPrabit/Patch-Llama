import { NextResponse } from 'next/server'
import { errorResponse, loadOwnedSession, requireAuthed } from '@/lib/api'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthed(request, 'session-get', 60)
    const { id } = await ctx.params
    const session = await loadOwnedSession(id, user.id)
    return NextResponse.json({ session })
  } catch (error) {
    return errorResponse(error)
  }
}
