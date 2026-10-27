/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama — workspace path safety
 */

const BLOCKED = /(^|\/)(\.env(\..*)?|\.git|node_modules)(\/|$)/i

export function normalizeProjectPath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('path must be relative')
  }
  if (normalized.split('/').includes('..')) throw new Error('path traversal rejected')
  if (BLOCKED.test(normalized)) throw new Error('protected path rejected')
  if (normalized.length > 400) throw new Error('path too long')
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
