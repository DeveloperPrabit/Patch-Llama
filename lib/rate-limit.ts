/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Simple in-memory rate limiter (per-process). Adequate for single-node hackathon deploy.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  const remaining = Math.max(0, limit - bucket.count)
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - now }
  }
  return { ok: true, remaining, retryAfterMs: 0 }
}

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const result = rateLimit(key, limit, windowMs)
  if (!result.ok) {
    const err = new Error(`Rate limit exceeded. Retry in ${Math.ceil(result.retryAfterMs / 1000)}s`)
    ;(err as Error & { status: number }).status = 429
    throw err
  }
}
