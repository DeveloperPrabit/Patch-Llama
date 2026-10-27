/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Neon PostgreSQL session store — production / hosted persistence.
 */

import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { getDb, type PatchllamaDb } from '@/db/client'
import { auditEvents, executions, patches, projects, sessions } from '@/db/schema'
import type { DebugSession } from '../types'
import { safeStorageError, VersionConflictError } from './errors'
import {
  assertValidSessionId,
  auditRows,
  executionRows,
  fromPayload,
  patchRows,
  toPayload,
} from './session-mapper'
import type { CreateSessionInput, SessionStore } from './types'

type Tx = Parameters<Parameters<PatchllamaDb['transaction']>[0]>[0]

async function ensureProject(tx: Tx, session: DebugSession): Promise<void> {
  const projectId = session.projectId?.trim()
  if (!projectId || projectId.length > 64) return
  const existing = await tx.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })
  if (existing) {
    if (existing.userId !== session.userId) {
      throw Object.assign(new Error('project not found'), { status: 404 })
    }
    return
  }
  await tx.insert(projects).values({
    id: projectId,
    userId: session.userId,
    name: session.intake?.title?.slice(0, 200) || projectId,
    repoFullName: session.repoFullName || null,
    defaultBranch: null,
  })
}

async function replaceChildren(tx: Tx, session: DebugSession): Promise<void> {
  await tx.delete(patches).where(eq(patches.sessionId, session.id))
  await tx.delete(executions).where(eq(executions.sessionId, session.id))
  await tx.delete(auditEvents).where(eq(auditEvents.sessionId, session.id))

  const pRows = patchRows(session)
  if (pRows.length) await tx.insert(patches).values(pRows)

  const eRows = executionRows(session)
  if (eRows.length) await tx.insert(executions).values(eRows)

  const aRows = auditRows(session)
  if (aRows.length) await tx.insert(auditEvents).values(aRows)
}

function sessionColumns(session: DebugSession, version: number) {
  return {
    userId: session.userId,
    projectId: session.projectId || null,
    status: session.status,
    evidenceSource: session.evidenceSource,
    workspaceId: session.workspaceId,
    workspaceRoot: session.workspaceRoot,
    commitSha: session.commitSha || null,
    repoFullName: session.repoFullName || null,
    fingerprint: session.workspaceFingerprint || null,
    repairAttempts: session.repairAttempts,
    payload: toPayload({ ...session, version }),
    version,
    updatedAt: new Date(session.updatedAt),
  }
}

export function createPostgresStore(db: PatchllamaDb = getDb()): SessionStore {
  return {
    async createSession(partial: CreateSessionInput): Promise<DebugSession> {
      const now = new Date().toISOString()
      const session: DebugSession = {
        ...partial,
        id: `dbg_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
        createdAt: now,
        updatedAt: now,
        patches: [],
        executions: [],
        repairAttempts: 0,
        version: 1,
        audit: [
          {
            id: randomUUID(),
            ts: now,
            type: 'session_created',
            detail: partial.intake.title,
          },
        ],
      }

      try {
        await db.transaction(async (tx) => {
          await ensureProject(tx, session)
          await tx.insert(sessions).values({
            id: session.id,
            createdAt: new Date(session.createdAt),
            ...sessionColumns(session, 1),
          })
          await replaceChildren(tx, session)
        })
        return session
      } catch (error) {
        throw safeStorageError(error)
      }
    },

    async getSession(id: string): Promise<DebugSession | null> {
      try {
        assertValidSessionId(id)
        const row = await db.query.sessions.findFirst({
          where: eq(sessions.id, id),
        })
        if (!row) return null
        return fromPayload(row.payload, {
          id: row.id,
          userId: row.userId,
          version: row.version,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          workspaceRoot: row.workspaceRoot,
          workspaceId: row.workspaceId,
        })
      } catch (error) {
        if (error instanceof Error && error.message === 'invalid session id') return null
        throw safeStorageError(error)
      }
    },

    async saveSession(session: DebugSession): Promise<DebugSession> {
      assertValidSessionId(session.id)
      const expected = session.version ?? 1
      const next: DebugSession = {
        ...session,
        updatedAt: new Date().toISOString(),
        version: expected + 1,
      }

      try {
        await db.transaction(async (tx) => {
          await ensureProject(tx, next)
          const updated = await tx
            .update(sessions)
            .set(sessionColumns(next, next.version!))
            .where(and(eq(sessions.id, next.id), eq(sessions.version, expected)))
            .returning({ id: sessions.id })

          if (!updated.length) {
            const exists = await tx.query.sessions.findFirst({
              where: eq(sessions.id, next.id),
              columns: { id: true },
            })
            if (!exists) {
              throw Object.assign(new Error('session not found'), { status: 404 })
            }
            throw new VersionConflictError()
          }

          await replaceChildren(tx, next)
        })
        return next
      } catch (error) {
        if (
          error instanceof VersionConflictError ||
          (error as { status?: number })?.status === 404
        ) {
          throw error
        }
        throw safeStorageError(error)
      }
    },

    async listSessionsForUser(userId: string, limit = 50): Promise<DebugSession[]> {
      try {
        const rows = await db
          .select()
          .from(sessions)
          .where(eq(sessions.userId, userId))
          .orderBy(desc(sessions.updatedAt))
          .limit(Math.min(Math.max(limit, 1), 200))

        return rows.map((row) =>
          fromPayload(row.payload, {
            id: row.id,
            userId: row.userId,
            version: row.version,
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
            workspaceRoot: row.workspaceRoot,
            workspaceId: row.workspaceId,
          })
        )
      } catch (error) {
        throw safeStorageError(error)
      }
    },
  }
}
