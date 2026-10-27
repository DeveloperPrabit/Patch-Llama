import { describe, expect, it } from 'vitest'
import { createSession, getSession } from '../store'
import { cancelSession } from '../pipeline'
import { createManagedWorkspace, writeWorkspaceFiles } from '../workspace-manager'

describe('session ownership', () => {
  it('rejects cross-user cancel', async () => {
    const ws = await createManagedWorkspace('own')
    await writeWorkspaceFiles(ws.root, [{ path: 'a.ts', content: 'export {}' }])
    const session = await createSession({
      projectId: 'p',
      organizationId: 'o',
      userId: 'user-a',
      status: 'intake',
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
    await expect(cancelSession(session.id, 'user-b')).rejects.toMatchObject({ status: 404 })
    const still = await getSession(session.id)
    expect(still?.status).toBe('intake')
  })
})
