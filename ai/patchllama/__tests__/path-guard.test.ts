import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { normalizeProjectPath, resolveInsideWorkspace, PathGuardError } from '../path-guard'

describe('path-guard', () => {
  it('rejects traversal and absolute paths', () => {
    expect(() => normalizeProjectPath('../etc/passwd')).toThrow(PathGuardError)
    expect(() => normalizeProjectPath('/etc/passwd')).toThrow(PathGuardError)
    expect(() => normalizeProjectPath('.env')).toThrow(PathGuardError)
    expect(() => normalizeProjectPath('secrets/key.pem')).toThrow(PathGuardError)
    expect(normalizeProjectPath('src/math.ts')).toBe('src/math.ts')
  })

  it('rejects symlink escapes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pl-ws-'))
    const outside = await mkdtemp(path.join(os.tmpdir(), 'pl-out-'))
    await writeFile(path.join(outside, 'secret.txt'), 'nope', 'utf8')
    await mkdir(path.join(root, 'src'), { recursive: true })
    try {
      await symlink(path.join(outside, 'secret.txt'), path.join(root, 'src', 'leak.txt'))
    } catch {
      // Windows may require admin for symlinks — skip if unsupported
      return
    }
    await expect(resolveInsideWorkspace(root, 'src/leak.txt')).rejects.toBeInstanceOf(PathGuardError)
  })
})
