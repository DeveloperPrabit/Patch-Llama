import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createManagedWorkspace, writeWorkspaceFiles } from '../workspace-manager'
import { createSession, getSession, saveSession } from '../store'
import { resetSessionStoreCache } from '../storage'

vi.mock('../../muse-spark/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../muse-spark/config')>()
  return {
    ...actual,
    isPatchllamaDemoMode: vi.fn(() => false),
    getMaxRepairAttempts: () => 2,
  }
})

vi.mock('../../muse-spark/client', () => ({
  createMuseSparkClient: vi.fn(),
}))

import { createMuseSparkClient } from '../../muse-spark/client'
import { isPatchllamaDemoMode } from '../../muse-spark/config'
import { analyzeSession } from '../pipeline'

async function seedSession(userId: string) {
  const ws = await createManagedWorkspace('an')
  await writeWorkspaceFiles(ws.root, [{ path: 'src/a.ts', content: 'export const n = 1\n' }])
  return createSession({
    projectId: 'p',
    organizationId: 'o',
    userId,
    status: 'intake',
    intake: {
      title: 't',
      failureType: 'test',
      command: 'bun test',
      exitCode: 1,
      stdout: '',
      stderr: 'fail',
      relevantPaths: ['src/a.ts'],
    },
    workspaceRoot: ws.root,
    workspaceId: ws.id,
    files: [{ path: 'src/a.ts', content: 'export const n = 1\n' }],
    evidenceSource: 'seeded_fixture',
    maxRepairAttempts: 2,
    isolation: 'docker',
  })
}

describe('analyzeSession failure safety', () => {
  let dataDir: string
  let prevData: string | undefined

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'pl-an-'))
    prevData = process.env.PATCHLLAMA_DATA_DIR
    process.env.PATCHLLAMA_DATA_DIR = dataDir
    process.env.PATCHLLAMA_STORAGE = 'json'
    resetSessionStoreCache()
    vi.mocked(isPatchllamaDemoMode).mockReturnValue(false)
  })

  afterEach(async () => {
    resetSessionStoreCache()
    if (prevData === undefined) delete process.env.PATCHLLAMA_DATA_DIR
    else process.env.PATCHLLAMA_DATA_DIR = prevData
    await rm(dataDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  it('persists blocked state when MODEL_API_KEY/client is missing', async () => {
    vi.mocked(createMuseSparkClient).mockReturnValue(null)
    const session = await seedSession('u1')
    const result = await analyzeSession(session.id, 'u1')
    expect(result.status).toBe('blocked')
    expect(result.error).toMatch(/MODEL_CONFIG_MISSING/)
    expect(result.audit.some((a) => a.type === 'analyze_failed')).toBe(true)
    const reloaded = await getSession(session.id)
    expect(reloaded?.status).toBe('blocked')
    expect(reloaded?.status).not.toBe('analyzing')
  })

  it('persists blocked state on model API errors', async () => {
    vi.mocked(createMuseSparkClient).mockReturnValue({
      model: 'muse-spark-1.3',
      chatJson: async () => {
        throw new Error('HTTP 503 from provider')
      },
    } as never)
    const session = await seedSession('u2')
    const result = await analyzeSession(session.id, 'u2')
    expect(result.status).toBe('blocked')
    expect(result.error).toMatch(/MODEL_API_ERROR|ANALYSIS_FAILED/)
    expect(result.status).not.toBe('analyzing')
  })

  it('persists blocked state on invalid structured model output', async () => {
    vi.mocked(createMuseSparkClient).mockReturnValue({
      model: 'muse-spark-1.3',
      chatJson: async (_req: unknown, parse: (raw: unknown) => unknown) => {
        return { data: parse({ not: 'a diagnosis' }) }
      },
    } as never)
    const session = await seedSession('u3')
    const result = await analyzeSession(session.id, 'u3')
    expect(result.status).toBe('blocked')
    expect(result.error).toMatch(/MODEL_OUTPUT_INVALID|ANALYSIS_FAILED/)
  })

  it('allows retry after failed analysis without duplicating approved patches', async () => {
    vi.mocked(createMuseSparkClient)
      .mockReturnValueOnce(null)
      .mockImplementation(() => {
        throw new Error('should use demo on second path')
      })

    const session = await seedSession('u4')
    const failed = await analyzeSession(session.id, 'u4')
    expect(failed.status).toBe('blocked')

    vi.mocked(isPatchllamaDemoMode).mockReturnValue(true)
    const ok = await analyzeSession(session.id, 'u4')
    expect(ok.status).toBe('awaiting_approval')
    expect(ok.patches.filter((p) => p.status === 'proposed')).toHaveLength(1)

    await saveSession({
      ...ok,
      patches: ok.patches.map((p) => ({ ...p, status: 'approved' as const })),
    })
    await expect(analyzeSession(session.id, 'u4')).rejects.toThrow(/approved or applied/)
  })

  it('surfaces storage failure when failure state cannot be persisted', async () => {
    vi.mocked(createMuseSparkClient).mockReturnValue(null)
    const session = await seedSession('u5')
    const storeMod = await import('../store')
    const origSave = storeMod.saveSession.bind(storeMod)
    let n = 0
    vi.spyOn(storeMod, 'saveSession').mockImplementation(async (s) => {
      n += 1
      if (n === 1) return origSave(s)
      throw Object.assign(new Error('postgres down'), { status: 503, code: 'STORAGE_UNAVAILABLE' })
    })

    await expect(analyzeSession(session.id, 'u5')).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    })
  })
})

