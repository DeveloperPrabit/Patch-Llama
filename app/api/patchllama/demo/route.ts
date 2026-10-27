/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * POST /api/patchllama/demo — seed a known-failure debugging session
 */

import { NextResponse } from 'next/server'
import { analyzeSession } from '@/ai/patchllama/pipeline'
import { seedDemoSession, type DemoScenario } from '@/ai/patchllama/seed-demo'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const Body = z.object({
  scenario: z.enum(['logic_bug', 'type_error', 'missing_import', 'bad_patch']).default('logic_bug'),
  analyze: z.boolean().default(true),
})

export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json().catch(() => ({})))
    let session = await seedDemoSession({ scenario: body.scenario as DemoScenario })
    if (body.analyze) session = await analyzeSession(session.id)
    return NextResponse.json(
      {
        session,
        demoModeLabel: process.env.MODEL_API_KEY
          ? 'Using Meta Muse Spark when configured'
          : 'DEMO / MOCK — not Muse Spark (MODEL_API_KEY unset)',
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: { code: 'demo_failed', message } }, { status: 500 })
  }
}
