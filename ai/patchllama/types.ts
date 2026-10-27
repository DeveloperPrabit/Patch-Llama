/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama — debug session domain types
 */

import type { Diagnosis, PatchProposal } from '../muse-spark/schemas'

export type SessionStatus =
  | 'intake'
  | 'analyzing'
  | 'awaiting_approval'
  | 'applying'
  | 'verifying'
  | 'verified'
  | 'failed'
  | 'partially_verified'
  | 'blocked'
  | 'cancelled'

export type TerminalReportStatus =
  | 'VERIFIED'
  | 'FAILED'
  | 'PARTIALLY_VERIFIED'
  | 'AWAITING_APPROVAL'
  | 'BLOCKED'
  | 'CANCELLED'

export type FailureIntake = {
  title: string
  failureType: 'build' | 'test' | 'typecheck' | 'runtime' | 'lint' | 'other'
  command: string
  exitCode: number
  stdout: string
  stderr: string
  stack?: string
  expected?: string
  actual?: string
  reproductionSteps?: string
  relevantPaths: string[]
}

export type WorkspaceFile = { path: string; content: string }

export type PatchRecord = {
  id: string
  createdAt: string
  proposal: PatchProposal
  source: 'muse-spark' | 'demo'
  status: 'proposed' | 'approved' | 'rejected' | 'applied' | 'rolled_back'
  approvedAt?: string
  appliedAt?: string
  snapshots?: Record<string, string | null>
}

export type ExecutionAttempt = {
  id: string
  createdAt: string
  kind: 'verify' | 'apply'
  command: string
  exitCode: number | null
  durationMs: number
  stdout: string
  stderr: string
  timedOut: boolean
  ok: boolean
}

export type AuditEvent = {
  id: string
  ts: string
  type: string
  detail: string
  meta?: Record<string, unknown>
}

export type DebugSession = {
  id: string
  createdAt: string
  updatedAt: string
  projectId: string
  organizationId: string
  userId: string
  status: SessionStatus
  intake: FailureIntake
  workspaceRoot: string
  files: WorkspaceFile[]
  diagnosis?: Diagnosis & { source: 'muse-spark' | 'demo'; model?: string }
  patches: PatchRecord[]
  executions: ExecutionAttempt[]
  repairAttempts: number
  maxRepairAttempts: number
  audit: AuditEvent[]
  error?: string
}

export function toReportStatus(session: DebugSession): TerminalReportStatus {
  switch (session.status) {
    case 'verified':
      return 'VERIFIED'
    case 'failed':
      return 'FAILED'
    case 'partially_verified':
      return 'PARTIALLY_VERIFIED'
    case 'awaiting_approval':
      return 'AWAITING_APPROVAL'
    case 'blocked':
      return 'BLOCKED'
    case 'cancelled':
      return 'CANCELLED'
    default:
      return session.patches.some((p) => p.status === 'proposed')
        ? 'AWAITING_APPROVAL'
        : 'FAILED'
  }
}
