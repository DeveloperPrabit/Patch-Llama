/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Canonical path + symlink escape protection for PatchLlama workspaces.
 */

import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

const BLOCKED = /(^|\/)(\.env(\..*)?|\.git|node_modules|\.ssh|\.aws|credentials|\.npmrc|\.netrc)(\/|$)/i
const BLOCKED_EXT = /\.(pem|key|p12|pfx|crt)$/i

export class PathGuardError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'absolute'
      | 'traversal'
      | 'protected'
      | 'escape'
      | 'symlink_escape'
      | 'too_long'
  ) {
    super(message)
    this.name = 'PathGuardError'
  }
}

/** Normalize a relative project path (no FS access). */
export function normalizeProjectPath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new PathGuardError('path must be relative', 'absolute')
  }
  if (normalized.split('/').includes('..')) {
    throw new PathGuardError('path traversal rejected', 'traversal')
  }
  if (BLOCKED.test(normalized) || BLOCKED_EXT.test(normalized)) {
    throw new PathGuardError('protected path rejected', 'protected')
  }
  if (normalized.length > 400) throw new PathGuardError('path too long', 'too_long')
  return normalized
}

export function isSafeProjectPath(input: string): boolean {
  try {
    normalizeProjectPath(input)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve `rel` under `workspaceRoot` with realpath containment.
 * Rejects symlink escapes and paths outside the canonical root.
 */
export async function resolveInsideWorkspace(
  workspaceRoot: string,
  rel: string
): Promise<{ abs: string; rel: string }> {
  const safeRel = normalizeProjectPath(rel)
  const rootReal = await realpath(workspaceRoot)
  const joined = path.resolve(rootReal, safeRel)
  // Ensure joined is under root before following the final symlink target.
  const rootPrefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep
  if (joined !== rootReal && !joined.startsWith(rootPrefix)) {
    throw new PathGuardError('path escapes workspace', 'escape')
  }

  // Walk parents; if a symlink points outside root, reject.
  let cursor = joined
  const seen = new Set<string>()
  while (cursor.startsWith(rootPrefix) || cursor === rootReal) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    try {
      const st = await lstat(cursor)
      if (st.isSymbolicLink()) {
        const target = await realpath(cursor)
        if (target !== rootReal && !target.startsWith(rootPrefix)) {
          throw new PathGuardError('symlink escapes workspace', 'symlink_escape')
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File may not exist yet (create/write) — check parent chain only.
        const parent = path.dirname(cursor)
        if (parent === cursor) break
        cursor = parent
        continue
      }
      throw error
    }
    const parent = path.dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }

  return { abs: joined, rel: safeRel }
}

export async function assertWorkspaceRoot(workspaceRoot: string, allowedRoots: string[]) {
  const real = await realpath(workspaceRoot)
  for (const allowed of allowedRoots) {
    let allowedReal: string
    try {
      allowedReal = await realpath(allowed)
    } catch {
      continue
    }
    const prefix = allowedReal.endsWith(path.sep) ? allowedReal : allowedReal + path.sep
    if (real === allowedReal || real.startsWith(prefix)) return real
  }
  throw new PathGuardError('workspace root not under managed roots', 'escape')
}
