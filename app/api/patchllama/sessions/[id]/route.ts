/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/ai/patchllama/store'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const session = await getSession(id)
  if (!session) {
    return NextResponse.json({ error: { code: 'not_found', message: 'session not found' } }, { status: 404 })
  }
  return NextResponse.json({ session })
}
