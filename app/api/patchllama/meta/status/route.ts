/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * GET /api/patchllama/meta/status — Meta Muse Spark connection status
 */

import { NextResponse } from 'next/server'
import { createMuseSparkClient } from '@/ai/muse-spark/client'
import { getMuseSparkConfig, isMuseSparkConfigured, isPatchllamaDemoMode } from '@/ai/muse-spark/config'

export const runtime = 'nodejs'

export async function GET() {
  const demo = isPatchllamaDemoMode()
  const configured = isMuseSparkConfigured()
  const config = getMuseSparkConfig()

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      demoMode: true,
      message:
        'MODEL_API_KEY is not set. PatchLlama is running in labeled demo/mock mode — not Muse Spark.',
      baseUrl: process.env.MODEL_API_BASE_URL || 'https://api.meta.ai/v1',
      model: process.env.MODEL_NAME || 'muse-spark-1.3',
    })
  }

  try {
    const client = createMuseSparkClient(config)
    if (!client) throw new Error('client unavailable')
    const ping = await client.ping()
    return NextResponse.json({
      ok: true,
      configured: true,
      demoMode: demo && false,
      model: ping.model,
      baseUrl: config?.baseUrl,
      preview: ping.preview,
      message: 'Authenticated to Meta Model API',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        demoMode: false,
        model: config?.model,
        baseUrl: config?.baseUrl,
        message,
      },
      { status: 502 }
    )
  }
}
