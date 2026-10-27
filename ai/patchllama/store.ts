/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Session persistence facade — delegates to JSON (local/demo) or Postgres (hosted).
 */

import { randomUUID } from 'node:crypto'
import type { DebugSession } from './types'
import { getSessionStore } from './storage'
import { redactSecretText, redactSecrets } from './storage/sanitize'
import type { CreateSessionInput } from './storage/types'

export type { CreateSessionInput }

export async function createSession(partial: CreateSessionInput): Promise<DebugSession> {
  return getSessionStore().createSession(partial)
}

export async function getSession(id: string): Promise<DebugSession | null> {
  return getSessionStore().getSession(id)
}

export async function saveSession(session: DebugSession): Promise<DebugSession> {
  return getSessionStore().saveSession(session)
}

export async function listSessionsForUser(userId: string, limit = 50): Promise<DebugSession[]> {
  return getSessionStore().listSessionsForUser(userId, limit)
}

/** @deprecated Use listSessionsForUser — global list is insecure. */
export async function listSessions(limit = 50): Promise<DebugSession[]> {
  return listSessionsForUser('__none__', limit)
}

export function appendAudit(
  session: DebugSession,
  type: string,
  detail: string,
  meta?: Record<string, unknown>
): DebugSession {
  return {
    ...session,
    audit: [
      ...session.audit,
      {
        id: randomUUID(),
        ts: new Date().toISOString(),
        type,
        detail: redactSecretText(detail),
        meta: meta ? redactSecrets(meta) : undefined,
      },
    ],
  }
}
