import { describe, expect, it } from 'vitest'
import { createSession, getSession } from '../store'
import { approvePatch, sessionReport } from '../pipeline'
import { createManagedWorkspace, writeWorkspaceFiles } from '../workspace-manager'

async function seedOwned(userId: string) {
  const ws = await createManagedWorkspace('ua')
  await writeWorkspaceFiles(ws.root, [{ path: 'a.ts', content: 'export {}' }])
  return createSession({
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
      relevantPaths: [],
    },
    workspaceRoot: ws.root,
    workspaceId: ws.id,
    files: [{ path: 'a.ts', content: 'export {}' }],
    evidenceSource: 'seeded_fixture',
    maxRepairAttempts: 2,
    isolation: 'docker',
  })
}

describe('unauthorized session access', () => {
  it('blocks report and approve for other users', async () => {
    const session = await seedOwned('owner-1')
    await expect(sessionReport(session.id, 'intruder')).rejects.toMatchObject({ status: 404 })
    await expect(approvePatch(session.id, 'missing', 'approve', 'intruder')).rejects.toMatchObject({
      status: 404,
    })
    const still = await getSession(session.id)
    expect(still?.userId).toBe('owner-1')
  })
})
