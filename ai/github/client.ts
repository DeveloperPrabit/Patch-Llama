/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * GitHub integration helpers — tokens never enter Muse Spark or Docker env.
 */

export type GithubRepoRef = {
  fullName: string
  defaultBranch: string
}

export async function githubFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  })
}

export async function resolveCommitSha(
  accessToken: string,
  fullName: string,
  branch: string
): Promise<string> {
  const res = await githubFetch(
    accessToken,
    `/repos/${fullName}/git/ref/heads/${encodeURIComponent(branch)}`
  )
  if (!res.ok) throw new Error(`Failed to resolve branch ${branch}: ${res.status}`)
  const data = (await res.json()) as { object?: { sha?: string } }
  if (!data.object?.sha) throw new Error('missing commit sha')
  return data.object.sha
}

export async function createRepairPullRequest(input: {
  accessToken: string
  fullName: string
  baseBranch: string
  headBranch: string
  title: string
  body: string
}) {
  const res = await githubFetch(input.accessToken, `/repos/${input.fullName}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      head: input.headBranch,
      base: input.baseBranch,
      body: input.body,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PR create failed (${res.status}): ${text.slice(0, 300)}`)
  }
  return res.json()
}
