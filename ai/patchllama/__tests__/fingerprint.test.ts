import { describe, expect, it } from 'vitest'
import { createManagedWorkspace, fingerprintWorkspace, writeWorkspaceFiles } from '../workspace-manager'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

describe('workspace fingerprint', () => {
  it('changes when file content changes (stale detection)', async () => {
    const ws = await createManagedWorkspace('fp')
    await writeWorkspaceFiles(ws.root, [{ path: 'src/a.ts', content: 'v1' }])
    const a = await fingerprintWorkspace(ws.root, ['src/a.ts'])
    await writeFile(path.join(ws.root, 'src/a.ts'), 'v2', 'utf8')
    const b = await fingerprintWorkspace(ws.root, ['src/a.ts'])
    expect(a).not.toBe(b)
  })
})
