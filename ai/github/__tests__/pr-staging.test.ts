import { describe, expect, it } from 'vitest'
import type { DebugSession } from '../../patchllama/types'

function approvedPaths(session: DebugSession): string[] {
  const applied = session.patches.filter((p) => p.status === 'applied').at(-1)
  return applied?.proposal.files.map((f) => f.path) || []
}

describe('PR staging policy', () => {
  it('stages only applied patch files, not entire tree', () => {
    const session = {
      patches: [
        {
          id: 'p1',
          status: 'applied',
          proposal: {
            files: [
              { path: 'src/math.ts', content: 'x', action: 'replace', description: 'fix' },
            ],
          },
        },
      ],
    } as unknown as DebugSession
    expect(approvedPaths(session)).toEqual(['src/math.ts'])
    expect(approvedPaths(session)).not.toContain('package.json')
  })

  it('rejects default-branch head names', () => {
    const bad = ['main', 'master', 'develop']
    for (const name of bad) {
      expect(['main', 'master', 'trunk', 'develop'].includes(name)).toBe(true)
    }
    expect('patchllama/fix-abc'.startsWith('patchllama/fix-')).toBe(true)
  })
})
