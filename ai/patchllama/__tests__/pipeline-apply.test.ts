import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagedWorkspace, writeWorkspaceFiles, fingerprintWorkspace } from '../workspace-manager'
import { createSession, getSession } from '../store'
import { resetSessionStoreCache } from '../storage'
import type { PatchProposal } from '../../muse-spark/schemas'

vi.mock('../docker-executor', () => ({
  IsolationUnavailableError: class IsolationUnavailableError extends Error {
    code = 'ISOLATION_UNAVAILABLE'
  },
  runInDocker: vi.fn(async () => ({
    id: 'ex_mock',
    createdAt: new Date().toISOString(),
    kind: 'verify',
    command: 'bun test',
    exitCode: 0,
    durationMs: 1,
    stdout: 'ok',
    stderr: '',
    timedOut: false,
    ok: true,
  })),
}))

import { approvePatch, rollbackPatch } from '../pipeline'

function proposal(files: PatchProposal['files']): PatchProposal {
  return {
    summary: 'fix',
    rationale: 'r',
    files,
    verification_commands: ['test'],
  }
}

async function seedWithProposed(
  userId: string,
  files: PatchProposal['files'],
  workspaceFiles: Array<{ path: string; content: string }>
) {
  const ws = await createManagedWorkspace('ap')
  await writeWorkspaceFiles(ws.root, workspaceFiles)
  const fp = await fingerprintWorkspace(
    ws.root,
    files.map((f) => f.path)
  )
  const session = await createSession({
    projectId: 'p',
    organizationId: 'o',
    userId,
    status: 'awaiting_approval',
    intake: {
      title: 't',
      failureType: 'test',
      command: 'bun test',
      exitCode: 1,
      stdout: '',
      stderr: 'fail',
      relevantPaths: workspaceFiles.map((f) => f.path),
    },
    workspaceRoot: ws.root,
    workspaceId: ws.id,
    files: workspaceFiles,
    evidenceSource: 'seeded_fixture',
    maxRepairAttempts: 2,
    isolation: 'docker',
  })
  const { saveSession } = await import('../store')
  return saveSession({
    ...session,
    patches: [
      {
        id: 'pat_testapply01',
        createdAt: new Date().toISOString(),
        source: 'demo',
        status: 'proposed',
        proposal: proposal(files),
        fingerprintAtPropose: fp,
      },
    ],
  })
}

describe('patch apply integrity', () => {
  let dataDir: string
  let prevData: string | undefined

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'pl-ap-'))
    prevData = process.env.PATCHLLAMA_DATA_DIR
    process.env.PATCHLLAMA_DATA_DIR = dataDir
    process.env.PATCHLLAMA_STORAGE = 'json'
    resetSessionStoreCache()
  })

  afterEach(async () => {
    resetSessionStoreCache()
    if (prevData === undefined) delete process.env.PATCHLLAMA_DATA_DIR
    else process.env.PATCHLLAMA_DATA_DIR = prevData
    await rm(dataDir, { recursive: true, force: true })
  })

  it('blocks create when target already exists and leaves prior files intact', async () => {
    const session = await seedWithProposed(
      'u1',
      [
        {
          path: 'src/new.ts',
          action: 'create',
          content: 'export const x = 1\n',
          description: 'add',
        },
      ],
      [{ path: 'src/new.ts', content: 'export const existing = true\n' }]
    )
    const result = await approvePatch(session.id, 'pat_testapply01', 'approve', 'u1')
    expect(result.status).toBe('blocked')
    expect(result.error).toMatch(/already exists/)
    const disk = await readFile(path.join(session.workspaceRoot, 'src/new.ts'), 'utf8')
    expect(disk).toContain('existing')
  })

  it('blocks replace when target is missing', async () => {
    const session = await seedWithProposed(
      'u2',
      [
        {
          path: 'src/missing.ts',
          action: 'replace',
          content: 'export const x = 1\n',
          description: 'replace',
        },
      ],
      [{ path: 'src/other.ts', content: 'export {}\n' }]
    )
    const result = await approvePatch(session.id, 'pat_testapply01', 'approve', 'u2')
    expect(result.status).toBe('blocked')
    expect(result.error).toMatch(/missing/)
  })

  it('rolls back earlier writes when a later file in the patch is blocked', async () => {
    const session = await seedWithProposed(
      'u3',
      [
        {
          path: 'src/a.ts',
          action: 'replace',
          content: 'export const a = 2\n',
          description: 'a',
        },
        {
          path: 'src/b.ts',
          action: 'replace',
          content: 'export const b = 2\n',
          description: 'b missing',
        },
      ],
      [{ path: 'src/a.ts', content: 'export const a = 1\n' }]
    )
    const result = await approvePatch(session.id, 'pat_testapply01', 'approve', 'u3')
    expect(result.status).toBe('blocked')
    const a = await readFile(path.join(session.workspaceRoot, 'src/a.ts'), 'utf8')
    expect(a).toBe('export const a = 1\n')
  })

  it('refuses rollback when file changed after apply', async () => {
    const session = await seedWithProposed(
      'u4',
      [
        {
          path: 'src/a.ts',
          action: 'replace',
          content: 'export const a = 2\n',
          description: 'a',
        },
      ],
      [{ path: 'src/a.ts', content: 'export const a = 1\n' }]
    )
    const applied = await approvePatch(session.id, 'pat_testapply01', 'approve', 'u4')
    expect(applied.status).toBe('verified')
    await writeFile(path.join(session.workspaceRoot, 'src/a.ts'), 'export const a = 999\n', 'utf8')
    const rolled = await rollbackPatch(session.id, 'pat_testapply01', 'u4')
    expect(rolled.status).toBe('blocked')
    expect(rolled.error).toMatch(/ROLLBACK_BLOCKED/)
    const disk = await readFile(path.join(session.workspaceRoot, 'src/a.ts'), 'utf8')
    expect(disk).toBe('export const a = 999\n')
  })

  it('rejects cross-user approve', async () => {
    const session = await seedWithProposed(
      'owner',
      [
        {
          path: 'src/a.ts',
          action: 'replace',
          content: 'export const a = 2\n',
          description: 'a',
        },
      ],
      [{ path: 'src/a.ts', content: 'export const a = 1\n' }]
    )
    await expect(approvePatch(session.id, 'pat_testapply01', 'approve', 'intruder')).rejects.toMatchObject({
      status: 404,
    })
    const still = await getSession(session.id)
    expect(still?.patches[0]?.status).toBe('proposed')
  })
})
