/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * POST /api/patchllama/demo — authenticated demo seed (fixture evidence labeled).
 */

import { NextResponse } from 'next/server'
import { analyzeSession, runBaseline } from '@/ai/patchllama/pipeline'
import { seedDemoSession, type DemoScenario } from '@/ai/patchllama/seed-demo'
import { IsolationUnavailableError } from '@/ai/patchllama/docker-executor'
import { errorResponse, readJsonLimited, requireAuthed } from '@/lib/api'
import { z } from 'zod/v4'

export const runtime = 'nodejs'

const Body = z.object({
  scenario: z.enum(['logic_bug', 'type_error', 'missing_import', 'bad_patch']).default('logic_bug'),
  analyze: z.boolean().default(true),
  /** When true, run Docker baseline before analyze (preferred for real evidence). */
  runBaseline: z.boolean().default(false),
})

export async function POST(request: Request) {
  try {
    const user = await requireAuthed(request, 'demo', 10)
    const body = Body.parse(await readJsonLimited(request))
    let session = await seedDemoSession({
      scenario: body.scenario as DemoScenario,
      userId: user.id,
    })

    if (body.runBaseline) {
      try {
        session = await runBaseline(session.id, user.id)
        if (session.status === 'inconclusive') {
          return NextResponse.json(
            {
              session,
              demoModeLabel: 'INCONCLUSIVE — baseline passed; fixture failure not reproduced',
              evidenceSource: session.evidenceSource,
            },
            { status: 201 }
          )
        }
      } catch (error) {
        if (error instanceof IsolationUnavailableError) {
          return NextResponse.json(
            {
              session,
              error: {
                code: 'ISOLATION_UNAVAILABLE',
                message: error.message,
              },
              demoModeLabel:
                'Fixture seeded, but verification/baseline blocked until Docker is healthy',
              evidenceSource: 'seeded_fixture',
            },
            { status: 503 }
          )
        }
        throw error
      }
    }

    if (body.analyze && session.status !== 'inconclusive') {
      session = await analyzeSession(session.id, user.id)
    }

    return NextResponse.json(
      {
        session,
        evidenceSource: session.evidenceSource,
        demoModeLabel: process.env.MODEL_API_KEY
          ? 'Using Meta Muse Spark when configured (fixture intake unless baseline ran)'
          : 'DEMO / MOCK — not Muse Spark (MODEL_API_KEY unset); evidence may be seeded_fixture',
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
