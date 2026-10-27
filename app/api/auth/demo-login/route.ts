/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Server-side demo login — creates Auth.js session for fixed demo-user (not client userId).
 */

import { signIn } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  try {
    await signIn('demo', { redirect: false })
    return NextResponse.json({ ok: true, userId: 'demo-user' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Auth.js may throw NEXT_REDIRECT; treat as success when cookie set.
    if (message.includes('NEXT_REDIRECT') || (error as { digest?: string })?.digest) {
      return NextResponse.json({ ok: true, userId: 'demo-user' })
    }
    return NextResponse.json({ error: { code: 'auth_failed', message } }, { status: 500 })
  }
}
