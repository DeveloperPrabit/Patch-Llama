/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Local/demo JSON session store — never used in production.
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DebugSession } from '../types'
import { VersionConflictError } from './errors'
import { assertValidSessionId, toPayload } from './session-mapper'
import type { CreateSessionInput, SessionStore } from './types'
import { redactSecrets } from './sanitize'

function dataDir(): string {
  return (
    process.env.PATCHLLAMA_DATA_DIR?.trim() ||
    path.join(process.cwd(), '.data', 'patchllama')
  )
}

function sessionPath(id: string): string {
  assertValidSessionId(id)
  return path.join(dataDir(), 'sessions', `${id}.json`)
}

async function atomicWrite(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, file)
}

export function createJsonStore(): SessionStore {
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
      await atomicWrite(
        sessionPath(session.id),
        JSON.stringify(redactSecrets(toPayload({ ...session, version: 1 })), null, 2)
      )
      return session
    },

    async getSession(id: string): Promise<DebugSession | null> {
      try {
        assertValidSessionId(id)
        const raw = await readFile(sessionPath(id), 'utf8')
        const parsed = JSON.parse(raw) as DebugSession
        return {
          ...parsed,
          version: typeof parsed.version === 'number' ? parsed.version : 1,
          patches: parsed.patches || [],
          executions: parsed.executions || [],
          audit: parsed.audit || [],
          repairAttempts: parsed.repairAttempts ?? 0,
        }
      } catch {
        return null
      }
    },

    async saveSession(session: DebugSession): Promise<DebugSession> {
      const expected = session.version ?? 1
      const existing = await this.getSession(session.id)
      if (!existing) {
        throw Object.assign(new Error('session not found'), { status: 404 })
      }
      if ((existing.version ?? 1) !== expected) {
        throw new VersionConflictError()
      }
      const next: DebugSession = {
        ...session,
        updatedAt: new Date().toISOString(),
        version: expected + 1,
      }
      await atomicWrite(
        sessionPath(next.id),
        JSON.stringify(redactSecrets({ ...toPayload(next), version: next.version }), null, 2)
      )
      return next
    },

    async listSessionsForUser(userId: string, limit = 50): Promise<DebugSession[]> {
      const dir = path.join(dataDir(), 'sessions')
      try {
        const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse()
        const out: DebugSession[] = []
        for (const file of files) {
          if (out.length >= limit) break
          const raw = await readFile(path.join(dir, file), 'utf8')
          const session = JSON.parse(raw) as DebugSession
          if (session.userId === userId) {
            out.push({
              ...session,
              version: typeof session.version === 'number' ? session.version : 1,
            })
          }
        }
        return out
      } catch {
        return []
      }
    },
  }
}
