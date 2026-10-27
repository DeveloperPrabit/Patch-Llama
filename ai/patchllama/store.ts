/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Local JSON session store — local/demo only. Hosted multi-user requires Postgres.
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { DebugSession } from './types'

function dataDir(): string {
  return (
    process.env.PATCHLLAMA_DATA_DIR?.trim() ||
    path.join(process.cwd(), '.data', 'patchllama')
  )
}

function sessionPath(id: string): string {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new Error('invalid session id')
  return path.join(dataDir(), 'sessions', `${id}.json`)
}

async function atomicWrite(file: string, content: string) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${randomUUID()}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, file)
}

export async function createSession(
  partial: Omit<
    DebugSession,
    'id' | 'createdAt' | 'updatedAt' | 'patches' | 'executions' | 'audit' | 'repairAttempts'
  >
): Promise<DebugSession> {
  const now = new Date().toISOString()
  const session: DebugSession = {
    ...partial,
    id: `dbg_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
    createdAt: now,
    updatedAt: now,
    patches: [],
    executions: [],
    repairAttempts: 0,
    audit: [
      {
        id: randomUUID(),
        ts: now,
        type: 'session_created',
        detail: partial.intake.title,
      },
    ],
  }
  await atomicWrite(sessionPath(session.id), JSON.stringify(session, null, 2))
  return session
}

export async function getSession(id: string): Promise<DebugSession | null> {
  try {
    const raw = await readFile(sessionPath(id), 'utf8')
    return JSON.parse(raw) as DebugSession
  } catch {
    return null
  }
}

export async function saveSession(session: DebugSession): Promise<DebugSession> {
  const next = { ...session, updatedAt: new Date().toISOString() }
  await atomicWrite(sessionPath(next.id), JSON.stringify(next, null, 2))
  return next
}

export async function listSessionsForUser(userId: string, limit = 50): Promise<DebugSession[]> {
  const dir = path.join(dataDir(), 'sessions')
  try {
    const { readdir } = await import('node:fs/promises')
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse()
    const out: DebugSession[] = []
    for (const file of files) {
      if (out.length >= limit) break
      const raw = await readFile(path.join(dir, file), 'utf8')
      const session = JSON.parse(raw) as DebugSession
      if (session.userId === userId) out.push(session)
    }
    return out
  } catch {
    return []
  }
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
      { id: randomUUID(), ts: new Date().toISOString(), type, detail, meta },
    ],
  }
}
