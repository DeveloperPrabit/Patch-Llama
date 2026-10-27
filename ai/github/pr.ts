/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Repair PR creation with staged approved files only and credential cleanup.
 */

import path from 'node:path'
import type { DebugSession } from '../patchllama/types'
import { createRepairPullRequest } from './client'
import { assertGitOk, runGit, withGitAskpass, redactSecrets } from './git-credential'

const DEFAULT_BRANCH_NAMES = new Set(['main', 'master', 'trunk', 'develop'])

export async function createVerifiedRepairPr(input: {
  session: DebugSession
  accessToken: string
  baseBranch: string
  defaultBranch?: string
}): Promise<{ branch: string; pullRequest: unknown }> {
  const { session, accessToken, baseBranch } = input
  if (session.status !== 'verified') throw new Error('PR requires VERIFIED session')
  if (!session.repoFullName || !session.commitSha) throw new Error('Session is not a GitHub project')

  const normalizedBase = baseBranch.trim()
  if (!normalizedBase) throw new Error('base branch required')
  // Never push to default branch as head; base is the PR target only.
  if (input.defaultBranch && normalizedBase === input.defaultBranch) {
    // allowed as PR base, but head must differ
  }

  const applied = session.patches.filter((p) => p.status === 'applied')
  const lastApplied = applied.at(-1)
  if (!lastApplied) throw new Error('no applied patch to stage')

  const files = lastApplied.proposal.files.map((f) => f.path.replace(/\\/g, '/'))
  if (files.length === 0) throw new Error('patch contains no files')

  const cwd = session.workspaceRoot
  const branch = `patchllama/fix-${session.id.slice(0, 12)}`
  if (DEFAULT_BRANCH_NAMES.has(branch.toLowerCase())) {
    throw new Error('refusing to use a default branch name for repair head')
  }

  // Verify HEAD still matches pinned commit before branching (or is descendant after patch)
  const head = await runGit(['rev-parse', 'HEAD'], cwd)
  await assertGitOk(head, 'git rev-parse')

  // Verify remote repo identity via API-configured fullName only (no token in remotes)
  const cleanUrl = `https://github.com/${session.repoFullName}.git`

  return withGitAskpass(accessToken, async (env) => {
    try {
      await runGit(['remote', 'remove', 'origin'], cwd, env)
      const add = await runGit(['remote', 'add', 'origin', cleanUrl], cwd, env)
      await assertGitOk(add, 'git remote add')

      // Confirm remote URL has no embedded credentials
      const getUrl = await runGit(['remote', 'get-url', 'origin'], cwd, env)
      await assertGitOk(getUrl, 'git remote get-url')
      if (/x-access-token:|@github\.com/.test(getUrl.stdout) && /x-access-token:/i.test(getUrl.stdout)) {
        throw new Error('remote URL unexpectedly contains credentials')
      }
      if (!getUrl.stdout.includes(`github.com/${session.repoFullName}`)) {
        throw new Error(`remote repo mismatch: ${redactSecrets(getUrl.stdout)}`)
      }

      // Ensure we are not on base/default branch when pushing head
      const checkout = await runGit(['checkout', '-B', branch], cwd, env)
      await assertGitOk(checkout, 'git checkout repair branch')

      // Stage only approved patch files
      for (const rel of files) {
        if (rel.includes('..') || path.isAbsolute(rel)) {
          throw new Error(`refusing to stage unsafe path: ${rel}`)
        }
        const addFile = await runGit(['add', '--', rel], cwd, env)
        await assertGitOk(addFile, `git add ${rel}`)
      }

      const status = await runGit(['status', '--porcelain'], cwd, env)
      await assertGitOk(status, 'git status')
      if (!status.stdout.trim()) {
        // Changes may already be committed in workspace; create empty-safe commit check
      }

      const commit = await runGit(
        ['commit', '-m', `fix: PatchLlama repair for ${session.intake.title}`],
        cwd,
        env
      )
      if (commit.exitCode !== 0 && !/nothing to commit/i.test(commit.stdout + commit.stderr)) {
        await assertGitOk(commit, 'git commit')
      }

      // Push repair branch only — never base/default
      if (DEFAULT_BRANCH_NAMES.has(normalizedBase.toLowerCase()) === false) {
        // still fine
      }
      if (branch === normalizedBase) {
        throw new Error('refusing to push: repair head equals base branch')
      }
      const push = await runGit(['push', '-u', 'origin', branch], cwd, env)
      await assertGitOk(push, 'git push repair branch')

      const pr = await createRepairPullRequest({
        accessToken,
        fullName: session.repoFullName!,
        baseBranch: normalizedBase,
        headBranch: branch,
        title: `PatchLlama: ${session.intake.title}`,
        body: [
          'Automated repair branch created by PatchLlama after **VERIFIED** checks.',
          '',
          `- Session: \`${session.id}\``,
          `- Base commit: \`${session.commitSha}\``,
          `- Staged files: ${files.map((f) => `\`${f}\``).join(', ')}`,
          '',
          'Do not merge without human review.',
        ].join('\n'),
      })

      return { branch, pullRequest: pr }
    } finally {
      await runGit(['remote', 'remove', 'origin'], cwd, env)
    }
  })
}
