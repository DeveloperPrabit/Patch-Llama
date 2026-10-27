/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { DebugSession } from '../types'

export type CreateSessionInput = Omit<
  DebugSession,
  'id' | 'createdAt' | 'updatedAt' | 'patches' | 'executions' | 'audit' | 'repairAttempts' | 'version'
>

export interface SessionStore {
  createSession(partial: CreateSessionInput): Promise<DebugSession>
  getSession(id: string): Promise<DebugSession | null>
  /** Optimistic concurrency: rejects if session.version does not match stored version. */
  saveSession(session: DebugSession): Promise<DebugSession>
  listSessionsForUser(userId: string, limit?: number): Promise<DebugSession[]>
}

export type SessionStoreFactory = () => SessionStore
