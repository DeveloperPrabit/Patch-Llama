/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Short-lived GIT_ASKPASS helper — tokens never appear in argv or remotes.
 */

import { randomUUID } from 'node:crypto'
import { chmod, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

export function redactSecrets(text: string): string {
  return text
    .replace(/x-access-token:[^@\s]+/gi, 'x-access-token:[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .replace(/ghp_[A-Za-z0-9]+/g, 'ghp_[REDACTED]')
    .replace(/gho_[A-Za-z0-9]+/g, 'gho_[REDACTED]')
}

export type GitRunResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export async function withGitAskpass<T>(
  token: string,
  fn: (env: NodeJS.ProcessEnv) => Promise<T>
): Promise<T> {
  const askDir = path.join(os.tmpdir(), `pl-askpass-${randomUUID()}`)
  await mkdir(askDir, { recursive: true })
  const isWin = process.platform === 'win32'
  const askPath = path.join(askDir, isWin ? 'askpass.cmd' : 'askpass.sh')

  if (isWin) {
    await writeFile(
      askPath,
      [
        '@echo off',
        'echo %~1 | findstr /I "Username" >nul',
        'if %errorlevel%==0 (echo x-access-token & exit /b 0)',
        'echo %GIT_ASKPASS_PASSWORD%',
      ].join('\r\n'),
      'utf8'
    )
  } else {
    await writeFile(
      askPath,
      `#!/bin/sh\ncase "$1" in\n  *Username*) echo "x-access-token" ;;\n  *) echo "$GIT_ASKPASS_PASSWORD" ;;\nesac\n`,
      'utf8'
    )
    await chmod(askPath, 0o700)
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_ASKPASS: askPath,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS_PASSWORD: token,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
  }

  try {
    return await fn(env)
  } finally {
    await unlink(askPath).catch(() => undefined)
    await rm(askDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export function runGit(
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): Promise<GitRunResult> {
  // Guard: never allow token-bearing clone URLs in argv
  const joined = args.join(' ')
  if (/x-access-token:|ghp_|gho_/i.test(joined)) {
    return Promise.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'refusing to run git with secret material in argv',
    })
  }
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => {
      stdout += redactSecrets(String(c))
      if (stdout.length > 40_000) stdout = stdout.slice(-40_000)
    })
    child.stderr.on('data', (c) => {
      stderr += redactSecrets(String(c))
      if (stderr.length > 40_000) stderr = stderr.slice(-40_000)
    })
    child.on('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }))
    child.on('error', (err) =>
      resolve({ exitCode: 1, stdout, stderr: redactSecrets(String(err)) })
    )
  })
}

export async function assertGitOk(result: GitRunResult, label: string) {
  if (result.exitCode !== 0) {
    throw new Error(`${label} failed (exit ${result.exitCode}): ${redactSecrets(result.stderr).slice(0, 400)}`)
  }
}
