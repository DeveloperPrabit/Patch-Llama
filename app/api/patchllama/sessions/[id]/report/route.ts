/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NextResponse } from 'next/server'
import { sessionReport } from '@/ai/patchllama/pipeline'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const report = await sessionReport(id)
    return NextResponse.json({ report })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: { code: 'not_found', message } }, { status: 404 })
  }
}
