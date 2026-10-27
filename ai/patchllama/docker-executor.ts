/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Docker-isolated command execution. Fail closed when Docker is unavailable.
 */

import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import path from 'node:path'
import type { ExecutionAttempt } from './types'
import { assertWorkspaceRoot } from './path-guard'
import { managedRoots } from './workspace-manager'

export class IsolationUnavailableError extends Error {
  readonly code = 'ISOLATION_UNAVAILABLE'
  constructor(message: string) {
    super(message)
    this.name = 'IsolationUnavailableError'
  }
}

export type ExecKind = 'test' | 'build' | 'typecheck'

const IMAGE = process.env.PATCHLLAMA_DOCKER_IMAGE?.trim() || 'oven/bun:1.2'
const MEMORY = process.env.PATCHLLAMA_DOCKER_MEMORY?.trim() || '512m'
const CPUS = process.env.PATCHLLAMA_DOCKER_CPUS?.trim() || '1'
const PIDS = process.env.PATCHLLAMA_DOCKER_PIDS?.trim() || '128'
const TIMEOUT_MS = Number(process.env.PATCHLLAMA_EXEC_TIMEOUT_MS) || 60_000

/** Minimal allowlisted env passed into the container — never MODEL_* or host secrets. */
export function sandboxEnv(): string[] {
  return [
    'CI=1',
    'HOME=/tmp',
    'TMPDIR=/tmp',
    'LANG=C.UTF-8',
    'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  ]
}

export function assertSandboxEnvSafe(envLines: string[] = sandboxEnv()) {
  for (const line of envLines) {
    const key = line.split('=')[0]
    if (/^(MODEL_|AUTH_|DATABASE_|GITHUB_|AWS_|OPENAI_|GIT_ASKPASS_PASSWORD)/i.test(key)) {
      throw new Error(`Forbidden env key in sandbox: ${key}`)
    }
  }
}

let dockerHealthyCache: { ok: boolean; checkedAt: number; detail: string } | null = null

export async function probeDocker(): Promise<{ ok: boolean; detail: string }> {
  if (dockerHealthyCache && Date.now() - dockerHealthyCache.checkedAt < 15_000) {
    return { ok: dockerHealthyCache.ok, detail: dockerHealthyCache.detail }
  }
  const result = await runHostCommand('docker', ['info', '--format', '{{.ServerVersion}}'], 8_000)
  const ok = result.exitCode === 0 && Boolean(result.stdout.trim())
  const detail = ok
    ? `docker ${result.stdout.trim()}`
    : `Docker daemon unavailable: ${(result.stderr || result.stdout || 'no output').slice(0, 300)}`
  dockerHealthyCache = { ok, detail, checkedAt: Date.now() }
  return { ok, detail }
}

export async function assertDockerAvailable(): Promise<void> {
  const probe = await probeDocker()
  if (!probe.ok) {
    throw new IsolationUnavailableError(
      `${probe.detail}. Real execution is blocked until Docker is healthy.`
    )
  }
}

function bunArgs(kind: ExecKind): string[] {
  if (kind === 'test') return ['test']
  if (kind === 'build') return ['run', 'build']
  return ['run', 'typecheck']
}

function killProcessTree(pid: number) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { shell: false, windowsHide: true })
    } else {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        process.kill(pid, 'SIGKILL')
      }
    }
  } catch {
    // best-effort
  }
}

export function runHostCommand(
  cmd: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: false,
      windowsHide: true,
      env: process.env,
      detached: process.platform !== 'win32',
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const finish = (payload: {
      exitCode: number
      stdout: string
      stderr: string
      timedOut: boolean
    }) => {
      if (settled) return
      settled = true
      resolve(payload)
    }
    const timer = setTimeout(() => {
      timedOut = true
      if (child.pid) killProcessTree(child.pid)
      else child.kill('SIGKILL')
    }, timeoutMs)
    child.stdout.on('data', (c) => {
      stdout += String(c)
      if (stdout.length > 80_000) stdout = stdout.slice(-80_000)
    })
    child.stderr.on('data', (c) => {
      stderr += String(c)
      if (stderr.length > 80_000) stderr = stderr.slice(-80_000)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish({ exitCode: code ?? 1, stdout, stderr, timedOut })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      finish({ exitCode: 1, stdout, stderr: String(err), timedOut })
    })
  })
}

/**
 * Run an allowlisted bun command inside Docker.
 * Mounts managed workspace at /workspace (rw — required for install/test writes).
 * Network disabled. Non-root user. Host secrets are not passed.
 */
export async function runInDocker(
  workspaceRoot: string,
  kind: ExecKind
): Promise<ExecutionAttempt> {
  await assertDockerAvailable()
  assertSandboxEnvSafe()
  const roots = managedRoots()
  await assertWorkspaceRoot(workspaceRoot, roots)

  const started = Date.now()
  const argsCmd = bunArgs(kind)
  const command = `bun ${argsCmd.join(' ')}`
  const absHost = path.resolve(workspaceRoot)

  const dockerArgs = [
    'run',
    '--rm',
    '--network',
    'none',
    '--user',
    '1000:1000',
    '--memory',
    MEMORY,
    '--cpus',
    CPUS,
    '--pids-limit',
    PIDS,
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=64m',
    '--workdir',
    '/workspace',
    '-v',
    `${absHost}:/workspace:rw`,
    ...sandboxEnv().flatMap((e) => ['-e', e]),
    IMAGE,
    'bun',
    ...argsCmd,
  ]

  const result = await runHostCommand('docker', dockerArgs, TIMEOUT_MS)
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    kind: 'verify',
    command: `docker:${command}`,
    exitCode: result.exitCode,
    durationMs: Date.now() - started,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.timedOut,
    ok: !result.timedOut && result.exitCode === 0,
  }
}
