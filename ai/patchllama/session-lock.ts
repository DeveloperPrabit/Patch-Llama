/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * In-process mutex for concurrent patch approve/apply on the same session.
 */

const locks = new Map<string, Promise<void>>()

export async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(sessionId) || Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const chain = prev.then(() => gate)
  locks.set(
    sessionId,
    chain.catch(() => undefined).then(() => undefined)
  )
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (locks.get(sessionId) === chain) locks.delete(sessionId)
  }
}
