/*
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Optional, operator-driven import of local JSON sessions into PostgreSQL.
 * Does not delete source files. Skips duplicates by session id.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/import-json-sessions.ts [--dir .data/patchllama/sessions]
 *
 * Never run against production without an explicit operator decision.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '../db/client'
import { auditEvents, executions, patches, projects, sessions } from '../db/schema'
import { redactSecrets } from '../ai/patchllama/storage/sanitize'
import {
  assertValidSessionId,
  auditRows,
  executionRows,
  patchRows,
  toPayload,
} from '../ai/patchllama/storage/session-mapper'
import type { DebugSession } from '../ai/patchllama/types'

function isDebugSession(value: unknown): value is DebugSession {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.userId === 'string' &&
    typeof s.status === 'string' &&
    typeof s.workspaceId === 'string' &&
    typeof s.workspaceRoot === 'string' &&
    typeof s.evidenceSource === 'string' &&
    s.intake != null &&
    typeof s.intake === 'object' &&
    Array.isArray(s.patches) &&
    Array.isArray(s.executions) &&
    Array.isArray(s.audit)
  )
}

async function main() {
  const dirArgIdx = process.argv.indexOf('--dir')
  const dir =
    (dirArgIdx >= 0 && process.argv[dirArgIdx + 1]) ||
    path.join(process.cwd(), '.data', 'patchllama', 'sessions')

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const db = getDb()
  let imported = 0
  let skipped = 0
  let invalid = 0

  let files: string[] = []
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
  } catch {
    console.log(`No session directory at ${dir} — nothing to import.`)
    await closeDb()
    return
  }

  for (const file of files) {
    const raw = await readFile(path.join(dir, file), 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      invalid++
      console.warn(`invalid JSON: ${file}`)
      continue
    }
    if (!isDebugSession(parsed)) {
      invalid++
      console.warn(`invalid session shape: ${file}`)
      continue
    }

    try {
      assertValidSessionId(parsed.id)
    } catch {
      invalid++
      console.warn(`invalid session id: ${file}`)
      continue
    }

    const existing = await db.query.sessions.findFirst({
      where: eq(sessions.id, parsed.id),
      columns: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }

    const session: DebugSession = {
      ...parsed,
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      repairAttempts: parsed.repairAttempts ?? 0,
    }

    await db.transaction(async (tx) => {
      if (session.projectId) {
        const proj = await tx.query.projects.findFirst({
          where: eq(projects.id, session.projectId),
        })
        if (!proj) {
          await tx.insert(projects).values({
            id: session.projectId,
            userId: session.userId,
            name: session.intake.title?.slice(0, 200) || session.projectId,
            repoFullName: session.repoFullName || null,
          })
        } else if (proj.userId !== session.userId) {
          throw new Error(`project ownership conflict for ${session.projectId}`)
        }
      }

      await tx.insert(sessions).values({
        id: session.id,
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
        payload: redactSecrets(toPayload(session)),
        version: session.version ?? 1,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      })

      const p = patchRows(session)
      if (p.length) await tx.insert(patches).values(p)
      const e = executionRows(session)
      if (e.length) await tx.insert(executions).values(e)
      const a = auditRows(session)
      if (a.length) await tx.insert(auditEvents).values(a)
    })

    imported++
    console.log(`imported ${session.id}`)
  }

  console.log(
    JSON.stringify({
      dir,
      imported,
      skippedDuplicates: skipped,
      invalid,
      note: 'Source JSON files were not deleted.',
    })
  )
  await closeDb()
}

main().catch(async (error) => {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(msg.replace(/postgres(?:ql)?:\/\/[^\s)'"]+/gi, '[redacted-db-url]'))
  await closeDb().catch(() => undefined)
  process.exit(1)
})
