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
  | 'inconclusive'
  | 'partially_verified'
  | 'blocked'
  | 'cancelled'

export type TerminalReportStatus =
  | 'VERIFIED'
  | 'FAILED'
  | 'INCONCLUSIVE'
  | 'PARTIALLY_VERIFIED'
  | 'AWAITING_APPROVAL'
  | 'BLOCKED'
  | 'CANCELLED'

export type EvidenceSource = 'seeded_fixture' | 'executed_baseline'

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
  /** Hash of file contents at analysis time — apply rejects if changed. */
  fingerprintAtPropose?: string
}

export type ExecutionAttempt = {
  id: string
  createdAt: string
  kind: 'baseline' | 'verify' | 'apply'
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
  /** Server-managed workspace only */
  workspaceRoot: string
  workspaceId: string
  files: WorkspaceFile[]
  evidenceSource: EvidenceSource
  commitSha?: string
  repoFullName?: string
  baseline?: ExecutionAttempt
  workspaceFingerprint?: string
  diagnosis?: Diagnosis & { source: 'muse-spark' | 'demo'; model?: string }
  patches: PatchRecord[]
  executions: ExecutionAttempt[]
  repairAttempts: number
  maxRepairAttempts: number
  audit: AuditEvent[]
  error?: string
  isolation?: 'docker' | 'unavailable' | 'demo_pending'
}

export function toReportStatus(session: DebugSession): TerminalReportStatus {
  switch (session.status) {
    case 'verified':
      return 'VERIFIED'
    case 'failed':
      return 'FAILED'
    case 'inconclusive':
      return 'INCONCLUSIVE'
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

export function kindFromFailure(
  failureType: FailureIntake['failureType']
): 'test' | 'build' | 'typecheck' {
  if (failureType === 'build') return 'build'
  if (failureType === 'typecheck') return 'typecheck'
  return 'test'
}
