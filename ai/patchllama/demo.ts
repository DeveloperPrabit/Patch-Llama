/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PatchLlama — deterministic demo diagnoses/patches (never labeled as Muse Spark).
 */

import type { Diagnosis, PatchProposal } from '../muse-spark/schemas'
import type { FailureIntake, WorkspaceFile } from './types'

export function demoDiagnosis(intake: FailureIntake, files: WorkspaceFile[]): Diagnosis {
  const joined = `${intake.stderr}\n${intake.stdout}\n${intake.stack || ''}`
  if (/sum\(|add\(|expected 5|received 4|toBe\(5\)/i.test(joined) || intake.title.includes('sum')) {
    return {
      problem_summary: 'Unit test expects sum(2,3) === 5 but the implementation returns 4.',
      failure_category: 'logic_bug',
      likely_root_cause: 'src/math.ts uses subtraction or an off-by-one instead of addition.',
      evidence: [
        { kind: 'log', summary: 'Test assertion failed for sum(2, 3)', quote: intake.stderr.slice(0, 400) },
        {
          kind: 'file',
          summary: 'Implementation does not add both operands',
          path: 'src/math.ts',
          quote: files.find((f) => f.path === 'src/math.ts')?.content.slice(0, 200),
        },
        { kind: 'hypothesis', summary: 'Confirm no other callers depend on the incorrect behavior' },
      ],
      relevant_files: [
        { path: 'src/math.ts', reason: 'Function under test' },
        { path: 'src/math.test.ts', reason: 'Failing assertion' },
      ],
      proposed_minimal_fix: 'Change the sum implementation to return a + b.',
      potential_side_effects: ['Call sites that accidentally depended on the wrong result would change.'],
      recommended_verification_commands: ['test'],
      confidence: 0.92,
      unresolved_uncertainties: [],
    }
  }
  if (/Cannot find module|Failed to resolve import|is not exported/i.test(joined)) {
    return {
      problem_summary: 'Build fails because a module import cannot be resolved.',
      failure_category: 'import_error',
      likely_root_cause: 'An import path points at a missing or misnamed file.',
      evidence: [
        { kind: 'log', summary: 'Resolver error in build output', quote: intake.stderr.slice(0, 400) },
        { kind: 'observation', summary: 'Relevant source files were provided for context' },
      ],
      relevant_files: intake.relevantPaths.map((path) => ({ path, reason: 'Referenced in failure intake' })),
      proposed_minimal_fix: 'Correct the import path or add the missing module.',
      potential_side_effects: ['Other imports of the same symbol may need the same path fix.'],
      recommended_verification_commands: ['build'],
      confidence: 0.85,
      unresolved_uncertainties: ['Exact intended module name if multiple candidates exist'],
    }
  }
  if (/TypeError|is not assignable|TS\d{4}/i.test(joined)) {
    return {
      problem_summary: 'Type checker reports an invalid function signature or assignability error.',
      failure_category: 'type_error',
      likely_root_cause: 'A function parameter or return type does not match its call sites.',
      evidence: [
        { kind: 'log', summary: 'Type error from checker', quote: intake.stderr.slice(0, 400) },
      ],
      relevant_files: intake.relevantPaths.map((path) => ({ path, reason: 'Involved in type error' })),
      proposed_minimal_fix: 'Align the function signature with the expected types used by callers.',
      potential_side_effects: ['Downstream call sites may need updates if the public type changes.'],
      recommended_verification_commands: ['typecheck'],
      confidence: 0.8,
      unresolved_uncertainties: [],
    }
  }
  return {
    problem_summary: intake.title || 'Failure requires investigation',
    failure_category: 'unknown',
    likely_root_cause: 'Insufficient evidence for a high-confidence root cause in demo mode.',
    evidence: [{ kind: 'log', summary: 'Captured failure output', quote: intake.stderr.slice(0, 400) }],
    relevant_files: intake.relevantPaths.map((path) => ({ path, reason: 'Provided by intake' })),
    proposed_minimal_fix: 'Inspect the failing command output and correct the smallest responsible change.',
    potential_side_effects: [],
    recommended_verification_commands: ['test'],
    confidence: 0.4,
    unresolved_uncertainties: ['Demo mode cannot call Muse Spark; confidence is limited.'],
  }
}

export function demoPatch(intake: FailureIntake, files: WorkspaceFile[]): PatchProposal {
  // Intentional insufficient patch — must run before the known-good math fix.
  if (/wrong-patch|still fails|intentional/i.test(intake.title)) {
    const target = files.find((f) => f.path === 'src/math.ts') || files[0]
    return {
      summary: 'No-op comment change (intentionally insufficient)',
      rationale:
        'Demo scenario: this patch does not address the real bug so verification should FAIL.',
      files: [
        {
          path: target?.path || 'src/math.ts',
          action: 'replace',
          content: `${target?.content || ''}// patchllama demo noop\n`,
          description: 'Intentionally insufficient patch',
        },
      ],
      verification_commands: ['test'],
    }
  }

  const math = files.find((f) => f.path === 'src/math.ts')
  if (math && /return\s+a\s*-\s*b|return\s+a\s*\+\s*b\s*-\s*1/.test(math.content)) {
    return {
      summary: 'Fix sum() to add both operands',
      rationale:
        'The failing unit test expects sum(2,3)===5. Replacing the incorrect expression with a + b is the minimal fix.',
      files: [
        {
          path: 'src/math.ts',
          action: 'replace',
          content: 'export function sum(a: number, b: number): number {\n  return a + b\n}\n',
          description: 'Correct sum implementation',
        },
      ],
      verification_commands: ['test'],
      unified_diff: `--- a/src/math.ts\n+++ b/src/math.ts\n@@ -1,3 +1,3 @@\n export function sum(a: number, b: number): number {\n-  return a - b\n+  return a + b\n }\n`,
    }
  }
  const greeter = files.find((f) => f.path === 'src/greeter.ts')
  if (greeter && /name:\s*number/.test(greeter.content)) {
    return {
      summary: 'Fix greeter parameter type to string',
      rationale: 'Call sites pass a string; the parameter type incorrectly requires number.',
      files: [
        {
          path: 'src/greeter.ts',
          action: 'replace',
          content:
            'export function greet(name: string): string {\n  return `Hello, ${name}!`\n}\n',
          description: 'Correct greet signature',
        },
      ],
      verification_commands: ['typecheck'],
    }
  }
  const app = files.find((f) => f.path === 'src/app.ts')
  if (app && /from\s+['\"]\.\/missing-util['\"]/.test(app.content)) {
    return {
      summary: 'Add missing util module',
      rationale: 'Build fails resolving ./missing-util. Create the module the import expects.',
      files: [
        {
          path: 'src/missing-util.ts',
          action: 'create',
          content: "export function label(): string {\n  return 'ok'\n}\n",
          description: 'Create missing util',
        },
      ],
      verification_commands: ['build'],
    }
  }
  return {
    summary: 'Minimal placeholder patch',
    rationale: 'Demo mode could not match a known failure pattern.',
    files: [
      {
        path: files[0]?.path || 'README.md',
        action: 'replace',
        content: files[0]?.content || '# demo\n',
        description: 'No-op fallback',
      },
    ],
    verification_commands: ['test'],
  }
}
