/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NextResponse } from 'next/server'
import { cancelSession } from '@/ai/patchllama/pipeline'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const session = await cancelSession(id)
    return NextResponse.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: { code: 'cancel_failed', message } }, { status: 400 })
  }
}
