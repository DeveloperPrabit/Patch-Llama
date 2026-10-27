/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Explicit local/demo login only. Disabled in production and when PATCHLLAMA_MODE is not demo|local.
 */

import { isDemoLoginEnabled, signIn } from '@/lib/auth'
import { evaluateAuthConfig } from '@/lib/auth-config'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  const cfg = evaluateAuthConfig()
  if (!cfg.ok) {
    return NextResponse.json({ error: { code: cfg.code, message: cfg.message } }, { status: 503 })
  }
  if (!isDemoLoginEnabled()) {
    return NextResponse.json(
      {
        error: {
          code: 'DEMO_LOGIN_DISABLED',
          message:
            'Demo login requires PATCHLLAMA_MODE=demo|local and AUTH_DEMO_LOGIN=1, and is disabled when NODE_ENV=production.',
        },
      },
      { status: 403 }
    )
  }
  try {
    await signIn('demo', { redirect: false })
    return NextResponse.json({ ok: true, userId: 'demo-user' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NEXT_REDIRECT') || (error as { digest?: string })?.digest) {
      return NextResponse.json({ ok: true, userId: 'demo-user' })
    }
    return NextResponse.json({ error: { code: 'auth_failed', message } }, { status: 500 })
  }
}
