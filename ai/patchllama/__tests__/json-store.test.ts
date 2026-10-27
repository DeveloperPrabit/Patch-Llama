import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createJsonStore } from '../storage/json-store'
import { VersionConflictError } from '../storage/errors'
import type { CreateSessionInput } from '../storage/types'

function sample(userId: string): CreateSessionInput {
  return {
    projectId: 'proj_1',
    organizationId: 'org_1',
    userId,
    status: 'intake',
    intake: {
      title: 'fail',
      failureType: 'test',
      command: 'bun test',
      exitCode: 1,
      stdout: '',
      stderr: 'boom',
      relevantPaths: [],
    },
    workspaceRoot: '/tmp/ws',
    workspaceId: 'ws_1',
    files: [{ path: 'a.ts', content: 'export {}' }],
    evidenceSource: 'seeded_fixture',
    maxRepairAttempts: 2,
    isolation: 'docker',
  }
}

describe('json session store', () => {
  let dir: string
  let prev: string | undefined

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'pl-json-'))
    prev = process.env.PATCHLLAMA_DATA_DIR
    process.env.PATCHLLAMA_DATA_DIR = dir
  })

  afterEach(async () => {
    if (prev === undefined) delete process.env.PATCHLLAMA_DATA_DIR
    else process.env.PATCHLLAMA_DATA_DIR = prev
    await rm(dir, { recursive: true, force: true })
  })

  it('creates, reads, updates, and lists by owner', async () => {
    const store = createJsonStore()
    const a = await store.createSession(sample('user-a'))
    const b = await store.createSession(sample('user-b'))

    expect(await store.getSession(a.id)).toMatchObject({ userId: 'user-a', version: 1 })
    const listed = await store.listSessionsForUser('user-a')
    expect(listed.map((s) => s.id)).toEqual([a.id])
    expect(listed.some((s) => s.id === b.id)).toBe(false)

    const saved = await store.saveSession({
      ...a,
      status: 'analyzing',
      audit: [
        ...a.audit,
        { id: 'x', ts: new Date().toISOString(), type: 't', detail: 'd' },
      ],
    })
    expect(saved.version).toBe(2)
    expect(saved.status).toBe('analyzing')

    const again = await store.getSession(a.id)
    expect(again?.audit.length).toBe(2)
  })

  it('detects version conflicts', async () => {
    const store = createJsonStore()
    const session = await store.createSession(sample('user-a'))
    await store.saveSession({ ...session, status: 'analyzing' })
    await expect(store.saveSession({ ...session, status: 'failed' })).rejects.toBeInstanceOf(
      VersionConflictError
    )
  })
})
