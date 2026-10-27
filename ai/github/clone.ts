/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Shallow clone at pinned SHA into a managed workspace. Token never logged or passed to Docker runs.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { createManagedWorkspace } from '../patchllama/workspace-manager'

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  return new Promise<{ exitCode: number; stderr: string }>((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' },
    })
    let stderr = ''
    child.stderr.on('data', (c) => {
      stderr += String(c)
      // Redact tokens if accidentally echoed
      stderr = stderr.replace(/x-access-token:[^@\s]+/gi, 'x-access-token:[REDACTED]')
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000)
    })
    child.on('close', (code) => resolve({ exitCode: code ?? 1, stderr }))
  })
}

export async function cloneRepoAtSha(input: {
  accessToken: string
  fullName: string
  commitSha: string
}): Promise<{ workspaceId: string; workspaceRoot: string; commitSha: string }> {
  if (!/^[0-9a-f]{7,40}$/i.test(input.commitSha)) {
    throw new Error('invalid commit sha')
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.fullName)) {
    throw new Error('invalid repository name')
  }

  const ws = await createManagedWorkspace('gh')
  const url = `https://x-access-token:${input.accessToken}@github.com/${input.fullName}.git`
  const clone = await run('git', ['clone', '--depth', '50', url, 'repo'], ws.root)
  if (clone.exitCode !== 0) {
    throw new Error(`git clone failed: ${clone.stderr.slice(0, 400)}`)
  }
  const repoDir = path.join(ws.root, 'repo')
  const checkout = await run('git', ['checkout', input.commitSha], repoDir)
  if (checkout.exitCode !== 0) {
    throw new Error(`git checkout failed: ${checkout.stderr.slice(0, 400)}`)
  }
  // Scrub remote so token is not left on disk in git config for later docker mounts
  await run('git', ['remote', 'remove', 'origin'], repoDir)
  return { workspaceId: ws.id, workspaceRoot: repoDir, commitSha: input.commitSha }
}
