/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Re-export path helpers (canonical implementation in path-guard.ts).
 */

export {
  normalizeProjectPath,
  isSafeProjectPath,
  resolveInsideWorkspace,
  PathGuardError,
} from './path-guard'
