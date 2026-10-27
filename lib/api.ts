/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Shared API helpers for auth, ownership, body size.
 */

import { NextResponse } from 'next/server'
import { requireUser, type AppUser } from '@/lib/auth'
import { assertRateLimit } from '@/lib/rate-limit'
import { getSession } from '@/ai/patchllama/store'
import { sanitizeErrorMessage } from '@/ai/patchllama/storage/sanitize'
import type { DebugSession } from '@/ai/patchllama/types'

const MAX_BODY_BYTES = Number(process.env.PATCHLLAMA_MAX_BODY_BYTES) || 1_500_000

export async function readJsonLimited(request: Request): Promise<unknown> {
  const len = Number(request.headers.get('content-length') || 0)
  if (len > MAX_BODY_BYTES) {
    const err = new Error(`Request body too large (max ${MAX_BODY_BYTES} bytes)`)
    ;(err as Error & { status: number }).status = 413
    throw err
  }
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    const err = new Error(`Request body too large (max ${MAX_BODY_BYTES} bytes)`)
    ;(err as Error & { status: number }).status = 413
    throw err
  }
  if (!text) return {}
  return JSON.parse(text)
}

export async function requireAuthed(
  request: Request,
  rateKey: string,
  limit = 30,
  windowMs = 60_000
): Promise<AppUser> {
  const user = await requireUser()
  assertRateLimit(`${rateKey}:${user.id}`, limit, windowMs)
  return user
}

export async function loadOwnedSession(sessionId: string, userId: string): Promise<DebugSession> {
  const session = await getSession(sessionId)
  if (!session || session.userId !== userId) {
    const err = new Error('session not found')
    ;(err as Error & { status: number }).status = 404
    throw err
  }
  return session
}

export function errorResponse(error: unknown) {
  const status = (error as { status?: number })?.status || 400
  const message = sanitizeErrorMessage(error)
  const code =
    (error as { code?: string })?.code ||
    (status === 401
      ? 'unauthorized'
      : status === 404
        ? 'not_found'
        : status === 409
          ? 'version_conflict'
          : status === 429
            ? 'rate_limited'
            : status === 503
              ? 'isolation_unavailable'
              : 'error')
  return NextResponse.json({ error: { code, message } }, { status })
}
