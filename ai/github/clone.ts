/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Shallow clone at pinned SHA. Token via GIT_ASKPASS only — never in argv/remotes/Docker.
 */

import path from 'node:path'
import { createManagedWorkspace } from '../patchllama/workspace-manager'
import { assertGitOk, runGit, withGitAskpass } from './git-credential'

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
  const cleanUrl = `https://github.com/${input.fullName}.git`

  return withGitAskpass(input.accessToken, async (env) => {
    const clone = await runGit(['clone', '--depth', '50', cleanUrl, 'repo'], ws.root, env)
    await assertGitOk(clone, 'git clone')
    const repoDir = path.join(ws.root, 'repo')
    const checkout = await runGit(['checkout', '--force', input.commitSha], repoDir, env)
    await assertGitOk(checkout, 'git checkout')
    const head = await runGit(['rev-parse', 'HEAD'], repoDir, env)
    await assertGitOk(head, 'git rev-parse')
    const actual = head.stdout.trim()
    if (!actual.toLowerCase().startsWith(input.commitSha.toLowerCase().slice(0, 7))) {
      throw new Error(`checked-out commit mismatch: expected ${input.commitSha}, got ${actual}`)
    }
    // Ensure no origin remote retains credentials
    await runGit(['remote', 'remove', 'origin'], repoDir, env)
    return { workspaceId: ws.id, workspaceRoot: repoDir, commitSha: actual }
  })
}
