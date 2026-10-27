/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Map DebugSession ↔ DB rows / JSON payload.
 */

import type { DebugSession, ExecutionAttempt, PatchRecord, AuditEvent } from '../types'
import { redactSecretText, redactSecrets } from './sanitize'

export type SessionPayload = Omit<DebugSession, 'version'> & { version?: number }

export function assertValidSessionId(id: string): void {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    throw new Error('invalid session id')
  }
}

export function toPayload(session: DebugSession): SessionPayload {
  const { version: _v, ...rest } = session
  return redactSecrets(rest)
}

export function fromPayload(
  payload: unknown,
  row: {
    id: string
    userId: string
    version: number
    updatedAt: Date | string
    createdAt: Date | string
    workspaceRoot: string
    workspaceId: string
  }
): DebugSession {
  if (!payload || typeof payload !== 'object') {
    throw new Error('invalid session payload')
  }
  const p = payload as SessionPayload
  if (p.userId && p.userId !== row.userId) {
    throw new Error('payload ownership mismatch')
  }
  const createdAt =
    typeof row.createdAt === 'string' ? row.createdAt : row.createdAt.toISOString()
  const updatedAt =
    typeof row.updatedAt === 'string' ? row.updatedAt : row.updatedAt.toISOString()

  return {
    ...p,
    id: row.id,
    userId: row.userId,
    workspaceRoot: row.workspaceRoot,
    workspaceId: row.workspaceId,
    createdAt: p.createdAt || createdAt,
    updatedAt,
    version: row.version,
    patches: Array.isArray(p.patches) ? (p.patches as PatchRecord[]) : [],
    executions: Array.isArray(p.executions) ? (p.executions as ExecutionAttempt[]) : [],
    audit: Array.isArray(p.audit) ? (p.audit as AuditEvent[]) : [],
    repairAttempts: typeof p.repairAttempts === 'number' ? p.repairAttempts : 0,
  }
}

export function patchRows(session: DebugSession) {
  return session.patches.map((patch) => ({
    id: patch.id,
    sessionId: session.id,
    status: patch.status,
    source: patch.source,
    payload: redactSecrets(patch),
    createdAt: new Date(patch.createdAt),
  }))
}

export function sanitizeExecution(ex: ExecutionAttempt): ExecutionAttempt {
  return {
    ...ex,
    stdout: redactSecretText(ex.stdout),
    stderr: redactSecretText(ex.stderr),
  }
}

export function executionRows(session: DebugSession) {
  return session.executions.map((ex) => {
    const safe = sanitizeExecution(ex)
    return {
      id: safe.id,
      sessionId: session.id,
      kind: safe.kind,
      command: safe.command,
      exitCode: safe.exitCode,
      ok: safe.ok ? 1 : 0,
      durationMs: safe.durationMs,
      stdout: safe.stdout,
      stderr: safe.stderr,
      timedOut: safe.timedOut ? 1 : 0,
      createdAt: new Date(safe.createdAt),
    }
  })
}

export function auditRows(session: DebugSession) {
  return session.audit.map((ev) => ({
    id: ev.id,
    sessionId: session.id,
    type: ev.type,
    detail: redactSecretText(ev.detail),
    meta: ev.meta ? redactSecrets(ev.meta) : null,
    createdAt: new Date(ev.ts),
  }))
}
