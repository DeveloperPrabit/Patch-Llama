/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Server-controlled workspace allocation. Clients never supply absolute roots.
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertWorkspaceRoot } from './path-guard'

export function managedRoots(): string[] {
  const custom = process.env.PATCHLLAMA_WORKSPACE_ROOT?.trim()
  const primary = custom || path.join(process.cwd(), '.data', 'workspaces')
  return [path.resolve(primary)]
}

export async function ensureManagedRoots(): Promise<string[]> {
  const roots = managedRoots()
  for (const root of roots) {
    await mkdir(root, { recursive: true })
  }
  return roots
}

export type ManagedWorkspace = {
  id: string
  root: string
  createdAt: string
}

/** Create an empty managed workspace directory under the server root. */
export async function createManagedWorkspace(prefix = 'ws'): Promise<ManagedWorkspace> {
  const roots = await ensureManagedRoots()
  const id = `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  const root = path.join(roots[0], id)
  await mkdir(root, { recursive: true })
  await assertWorkspaceRoot(root, roots)
  return { id, root, createdAt: new Date().toISOString() }
}

export async function fingerprintWorkspace(root: string, relPaths: string[]): Promise<string> {
  const hash = createHash('sha256')
  const sorted = [...relPaths].sort()
  for (const rel of sorted) {
    hash.update(rel)
    hash.update('\0')
    try {
      const content = await readFile(path.join(root, rel), 'utf8')
      hash.update(content)
    } catch {
      hash.update('<missing>')
    }
    hash.update('\n')
  }
  return hash.digest('hex')
}

export async function writeWorkspaceFiles(
  root: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  const { resolveInsideWorkspace } = await import('./path-guard')
  for (const file of files) {
    const { abs } = await resolveInsideWorkspace(root, file.path)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, file.content, 'utf8')
  }
}

export async function destroyManagedWorkspace(root: string): Promise<void> {
  const roots = managedRoots()
  await assertWorkspaceRoot(root, roots)
  await rm(root, { recursive: true, force: true })
}

export async function listManagedWorkspaceIds(): Promise<string[]> {
  const roots = await ensureManagedRoots()
  try {
    return await readdir(roots[0])
  } catch {
    return []
  }
}
