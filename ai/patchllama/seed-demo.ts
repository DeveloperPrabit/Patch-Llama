/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Seed a workspace from fixtures/patchllama-demo.
 * Intake stderr is labeled seeded_fixture until baseline is executed in Docker.
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { startDebugSession } from './pipeline'
import type { FailureIntake, WorkspaceFile } from './types'
import { createManagedWorkspace, writeWorkspaceFiles } from './workspace-manager'

export type DemoScenario = 'logic_bug' | 'type_error' | 'missing_import' | 'bad_patch'

function fixtureRoot(): string {
  const hit = path.join(process.cwd(), 'fixtures', 'patchllama-demo')
  if (!existsSync(path.join(hit, 'package.json'))) {
    throw new Error(`patchllama-demo fixture not found (cwd=${process.cwd()})`)
  }
  return hit
}

async function readFixtureFiles(relPaths: string[]): Promise<WorkspaceFile[]> {
  const root = path.resolve(fixtureRoot())
  const files: WorkspaceFile[] = []
  for (const rel of relPaths) {
    const content = await readFile(path.join(root, rel), 'utf8')
    files.push({ path: rel, content })
  }
  return files
}

function intakeFor(scenario: DemoScenario, stderr: string, command: string): FailureIntake {
  const base = {
    exitCode: 1,
    stdout: '',
    stderr,
    relevantPaths: [] as string[],
  }
  switch (scenario) {
    case 'logic_bug':
    case 'bad_patch':
      return {
        ...base,
        title: scenario === 'bad_patch' ? 'Intentional wrong-patch demo' : 'Failing unit test: sum',
        failureType: 'test',
        command,
        expected: '5',
        actual: '4',
        relevantPaths: ['src/math.ts', 'src/math.test.ts'],
      }
    case 'type_error':
      return {
        ...base,
        title: 'Type error in greeter signature',
        failureType: 'typecheck',
        command,
        relevantPaths: ['src/greeter.ts'],
      }
    case 'missing_import':
      return {
        ...base,
        title: 'Build failure: missing import',
        failureType: 'build',
        command,
        relevantPaths: ['src/app.ts'],
      }
  }
}

export async function seedDemoSession(input: {
  scenario: DemoScenario
  userId: string
  projectId?: string
  organizationId?: string
}) {
  const scenario = input.scenario
  let files: WorkspaceFile[]
  let command: string
  let stderr: string

  if (scenario === 'logic_bug' || scenario === 'bad_patch') {
    files = await readFixtureFiles([
      'src/math.ts',
      'src/math.test.ts',
      'package.json',
      'tsconfig.json',
    ])
    command = 'bun test'
    stderr =
      '[seeded_fixture] error: expect(received).toBe(expected)\n\nExpected: 5\nReceived: -1\n\n at src/math.test.ts:5'
  } else if (scenario === 'type_error') {
    files = await readFixtureFiles(['src/greeter.ts', 'package.json', 'tsconfig.json'])
    command = 'bun run typecheck'
    stderr =
      "[seeded_fixture] src/greeter.ts(5,16): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'."
  } else {
    files = await readFixtureFiles(['src/app.ts', 'package.json', 'tsconfig.json'])
    command = 'bun run build'
    stderr = `[seeded_fixture] Failed to resolve import "./missing-util" from "src/app.ts". Does the file exist?`
  }

  const ws = await createManagedWorkspace('demo')
  const fixture = path.resolve(fixtureRoot())
  await cp(path.join(fixture, 'package.json'), path.join(ws.root, 'package.json'))
  await cp(path.join(fixture, 'tsconfig.json'), path.join(ws.root, 'tsconfig.json'))
  await writeWorkspaceFiles(ws.root, files)

  const session = await startDebugSession({
    projectId: input.projectId || 'demo-project',
    organizationId: input.organizationId || 'demo-org',
    userId: input.userId,
    intake: intakeFor(scenario, stderr, command),
    files,
    workspaceRoot: ws.root,
    workspaceId: ws.id,
    evidenceSource: 'seeded_fixture',
  })
  return session
}
