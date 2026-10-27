/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NextResponse } from 'next/server'
import { analyzeSession } from '@/ai/patchllama/pipeline'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const session = await analyzeSession(id)
    return NextResponse.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: { code: 'analyze_failed', message } }, { status: 400 })
  }
}
