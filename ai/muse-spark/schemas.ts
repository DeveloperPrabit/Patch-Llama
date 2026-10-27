/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama — structured Muse Spark output schemas (zod v4).
 */

import { z } from 'zod/v4'

export const FailureCategory = z.enum([
  'build_error',
  'test_failure',
  'type_error',
  'runtime_exception',
  'lint_error',
  'import_error',
  'logic_bug',
  'unknown',
])

export const EvidenceItem = z.object({
  kind: z.enum(['log', 'stack', 'file', 'observation', 'hypothesis']),
  summary: z.string().min(1).max(2000),
  path: z.string().max(400).optional(),
  line: z.number().int().positive().optional(),
  quote: z.string().max(2000).optional(),
})

export const DiagnosisSchema = z.object({
  problem_summary: z.string().min(1).max(2000),
  failure_category: FailureCategory,
  likely_root_cause: z.string().min(1).max(4000),
  evidence: z.array(EvidenceItem).min(1).max(20),
  relevant_files: z
    .array(
      z.object({
        path: z.string().min(1).max(400),
        line: z.number().int().positive().optional(),
        reason: z.string().max(500),
      })
    )
    .max(20),
  proposed_minimal_fix: z.string().min(1).max(4000),
  potential_side_effects: z.array(z.string().max(500)).max(10),
  recommended_verification_commands: z
    .array(z.enum(['test', 'build', 'typecheck']))
    .min(1)
    .max(3),
  confidence: z.number().min(0).max(1),
  unresolved_uncertainties: z.array(z.string().max(500)).max(10),
})
export type Diagnosis = z.infer<typeof DiagnosisSchema>

export const PatchFileChange = z.object({
  path: z.string().min(1).max(400),
  action: z.enum(['replace', 'create']),
  content: z.string().max(400_000),
  description: z.string().min(1).max(500),
})

export const PatchProposalSchema = z.object({
  summary: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(4000),
  unified_diff: z.string().max(500_000).optional(),
  files: z.array(PatchFileChange).min(1).max(20),
  verification_commands: z.array(z.enum(['test', 'build', 'typecheck'])).min(1).max(3),
})
export type PatchProposal = z.infer<typeof PatchProposalSchema>

export const DIAGNOSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'problem_summary',
    'failure_category',
    'likely_root_cause',
    'evidence',
    'relevant_files',
    'proposed_minimal_fix',
    'potential_side_effects',
    'recommended_verification_commands',
    'confidence',
    'unresolved_uncertainties',
  ],
  properties: {
    problem_summary: { type: 'string' },
    failure_category: {
      type: 'string',
      enum: FailureCategory.options,
    },
    likely_root_cause: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'summary'],
        properties: {
          kind: {
            type: 'string',
            enum: ['log', 'stack', 'file', 'observation', 'hypothesis'],
          },
          summary: { type: 'string' },
          path: { type: 'string' },
          line: { type: 'integer' },
          quote: { type: 'string' },
        },
      },
    },
    relevant_files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'reason'],
        properties: {
          path: { type: 'string' },
          line: { type: 'integer' },
          reason: { type: 'string' },
        },
      },
    },
    proposed_minimal_fix: { type: 'string' },
    potential_side_effects: { type: 'array', items: { type: 'string' } },
    recommended_verification_commands: {
      type: 'array',
      items: { type: 'string', enum: ['test', 'build', 'typecheck'] },
    },
    confidence: { type: 'number' },
    unresolved_uncertainties: { type: 'array', items: { type: 'string' } },
  },
} as const

export const PATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'rationale', 'files', 'verification_commands'],
  properties: {
    summary: { type: 'string' },
    rationale: { type: 'string' },
    unified_diff: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'action', 'content', 'description'],
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['replace', 'create'] },
          content: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    verification_commands: {
      type: 'array',
      items: { type: 'string', enum: ['test', 'build', 'typecheck'] },
    },
  },
} as const
