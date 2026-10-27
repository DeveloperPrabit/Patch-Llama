/**
 * Opt-in Neon integration tests.
 * Set PATCHLLAMA_TEST_DATABASE_URL (or DATABASE_URL with PATCHLLAMA_RUN_DB_TESTS=1).
 * Never pointed at a shared production database without operator intent.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, getDb } from '@/db/client'
import { createPostgresStore } from '../storage/postgres-store'
import { VersionConflictError } from '../storage/errors'
import type { CreateSessionInput } from '../storage/types'
import { eq } from 'drizzle-orm'
import { sessions } from '@/db/schema'

const testUrl =
  process.env.PATCHLLAMA_TEST_DATABASE_URL?.trim() ||
  (process.env.PATCHLLAMA_RUN_DB_TESTS === '1' ? process.env.DATABASE_URL?.trim() : '') ||
  ''

const describeDb = testUrl ? describe : describe.skip

function sample(userId: string, title = 'neon-test'): CreateSessionInput {
  return {
    projectId: `proj_${userId}`.slice(0, 64),
    organizationId: 'org_test',
    userId,
    status: 'intake',
    intake: {
      title,
      failureType: 'test',
      command: 'bun test',
      exitCode: 1,
      stdout: '',
      stderr: 'fail',
      relevantPaths: ['a.ts'],
    },
    workspaceRoot: '.data/workspaces/test-only',
    workspaceId: `ws_${userId}`.slice(0, 64),
    files: [{ path: 'a.ts', content: 'export const x = 1' }],
    evidenceSource: 'seeded_fixture',
    maxRepairAttempts: 2,
    isolation: 'docker',
  }
}

describeDb('postgres session store (Neon integration)', () => {
  const createdIds: string[] = []

  beforeAll(() => {
    process.env.DATABASE_URL = testUrl
  })

  afterAll(async () => {
    try {
      const db = getDb()
      for (const id of createdIds) {
        await db.delete(sessions).where(eq(sessions.id, id))
      }
    } catch {
      // ignore cleanup failures
    }
    await closeDb()
  }, 60_000)

  it(
    'creates, reads, updates, lists, isolates owners, and persists across clients',
    async () => {
      const store1 = createPostgresStore(getDb())
      const a = await store1.createSession(sample('owner_a'))
      const b = await store1.createSession(sample('owner_b'))
      createdIds.push(a.id, b.id)

      expect(a.version).toBe(1)
      expect(await store1.getSession(a.id)).toMatchObject({ id: a.id, userId: 'owner_a' })

      const listedA = await store1.listSessionsForUser('owner_a')
      expect(listedA.every((s) => s.userId === 'owner_a')).toBe(true)
      expect(listedA.some((s) => s.id === b.id)).toBe(false)

      const withPatch = await store1.saveSession({
        ...a,
        status: 'awaiting_approval',
        patches: [
          {
            id: `pat_${a.id}`.slice(0, 64),
            createdAt: new Date().toISOString(),
            source: 'demo',
            status: 'proposed',
            proposal: {
              summary: 'fix',
              rationale: 'r',
              files: [
                {
                  path: 'a.ts',
                  action: 'replace',
                  content: 'export const x = 2',
                  description: 'bump',
                },
              ],
              verification_commands: ['test'],
            },
          },
        ],
        executions: [
          {
            id: `ex_${a.id}`.slice(0, 64),
            createdAt: new Date().toISOString(),
            kind: 'baseline',
            command: 'bun test',
            exitCode: 1,
            durationMs: 10,
            stdout: '',
            stderr: 'fail',
            timedOut: false,
            ok: false,
          },
        ],
        audit: [
          ...a.audit,
          { id: `aud_${a.id}`.slice(0, 64), ts: new Date().toISOString(), type: 't', detail: 'd' },
        ],
        repairAttempts: 1,
      })
      expect(withPatch.version).toBe(2)

      // Fresh store instance, same pool — proves read path reconstructs nested state from DB.
      const store2 = createPostgresStore(getDb())
      const reloaded = await store2.getSession(a.id)
      expect(reloaded?.patches).toHaveLength(1)
      expect(reloaded?.executions[0]?.exitCode).toBe(1)
      expect(reloaded?.audit.length).toBeGreaterThanOrEqual(2)
      expect(reloaded?.repairAttempts).toBe(1)
      expect(reloaded?.version).toBe(2)

      // Raw SQL round-trip (survives beyond in-memory object identity)
      const row = await getDb().query.sessions.findFirst({ where: eq(sessions.id, a.id) })
      expect(row?.userId).toBe('owner_a')
      expect(row?.version).toBe(2)
      expect(row?.status).toBe('awaiting_approval')
    },
    60_000
  )

  it(
    'detects version conflicts and does not partially apply',
    async () => {
      const store = createPostgresStore(getDb())
      const session = await store.createSession(sample('owner_conflict', 'conflict'))
      createdIds.push(session.id)

      await store.saveSession({ ...session, status: 'analyzing' })
      await expect(
        store.saveSession({ ...session, status: 'failed', repairAttempts: 99 })
      ).rejects.toBeInstanceOf(VersionConflictError)

      const current = await store.getSession(session.id)
      expect(current?.status).toBe('analyzing')
      expect(current?.repairAttempts).toBe(0)
    },
    60_000
  )
})

describe('postgres store gate', () => {
  it('records whether Neon integration tests ran', () => {
    if (!testUrl) {
      console.info(
        '[skipped] Neon integration tests — set PATCHLLAMA_TEST_DATABASE_URL or PATCHLLAMA_RUN_DB_TESTS=1 with DATABASE_URL'
      )
    }
    expect(true).toBe(true)
  })
})
