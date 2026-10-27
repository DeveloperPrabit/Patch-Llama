/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Never persist credentials in session payloads or audit metadata.
 */

const SECRET_KEY =
  /^(authorization|cookie|password|secret|token|api[_-]?key|database_url|auth_secret|github_token|access_token|refresh_token|model_api_key)$/i

export function redactSecrets<T>(value: T, depth = 0): T {
  if (depth > 8 || value == null) return value
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v, depth + 1)) as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        out[k] = '[redacted]'
        continue
      }
      if (typeof v === 'string' && /postgres(?:ql)?:\/\//i.test(v)) {
        out[k] = '[redacted-db-url]'
        continue
      }
      out[k] = redactSecrets(v, depth + 1)
    }
    return out as T
  }
  return value
}
