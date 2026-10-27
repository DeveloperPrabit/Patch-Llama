/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Best-effort secret redaction for persisted payloads, logs, and API errors.
 *
 * LIMITATION: Regex-based detection cannot guarantee every secret is found.
 * Prefer not putting credentials in workspaces, command output, or model context.
 */

const SECRET_KEY =
  /^(authorization|cookie|password|passwd|secret|token|api[_-]?key|database_url|auth_secret|github_token|access_token|refresh_token|model_api_key|client_secret|private_key)$/i

const TEXT_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // Connection strings / URLs with credentials
  { re: /postgres(?:ql)?:\/\/[^\s)'"`]+/gi, replacement: '[redacted-db-url]' },
  { re: /mysql:\/\/[^\s)'"`]+/gi, replacement: '[redacted-db-url]' },
  { re: /mongodb(?:\+srv)?:\/\/[^\s)'"`]+/gi, replacement: '[redacted-db-url]' },
  { re: /https?:\/\/[^/\s:'"]+:[^/\s:'"]+@[^\s)'"`]+/gi, replacement: '[redacted-url-with-credentials]' },
  // Cloud / vendor tokens
  { re: /\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/g, replacement: '[redacted-github-token]' },
  { re: /\b(github_pat_[A-Za-z0-9_]{20,})\b/g, replacement: '[redacted-github-token]' },
  { re: /\b(sk-[A-Za-z0-9_-]{20,})\b/g, replacement: '[redacted-api-key]' },
  { re: /\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g, replacement: '[redacted-api-key]' },
  { re: /\b(LLM_[A-Za-z0-9_-]{16,})\b/g, replacement: '[redacted-api-key]' },
  { re: /\b(npg_[A-Za-z0-9]{10,})\b/g, replacement: '[redacted]' },
  { re: /\b(AKIA[0-9A-Z]{16})\b/g, replacement: '[redacted-aws-key]' },
  { re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g, replacement: '[redacted-slack-token]' },
  // Bearer / Authorization headers in logs
  { re: /(Authorization:\s*Bearer\s+)[A-Za-z0-9._\-+=\/]+/gi, replacement: '$1[redacted]' },
  { re: /(Bearer\s+)[A-Za-z0-9._\-+=\/]{20,}/gi, replacement: '$1[redacted]' },
  // Common env-style assignments (key=value)
  {
    re: /\b((?:API[_-]?KEY|AUTH_SECRET|DATABASE_URL|MODEL_API_KEY|GITHUB_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|PASSWORD|PASSWD)\s*[=:]\s*)([^\s'"`]+)/gi,
    replacement: '$1[redacted]',
  },
  // PEM private keys
  {
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[redacted-private-key]',
  },
]

/** Redact credential-like substrings in free-form text. */
export function redactSecretText(input: string): string {
  let out = input
  for (const { re, replacement } of TEXT_PATTERNS) {
    out = out.replace(re, replacement)
  }
  return out
}

/** Deep-redact objects: secret keys + credential patterns inside strings. */
export function redactSecrets<T>(value: T, depth = 0): T {
  if (depth > 10 || value == null) return value
  if (typeof value === 'string') {
    return redactSecretText(value) as T
  }
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
      out[k] = redactSecrets(v, depth + 1)
    }
    return out as T
  }
  return value
}

/** Safe client/API error message — never include connection strings or tokens. */
export function sanitizeErrorMessage(error: unknown, fallback = 'operation failed'): string {
  const raw = error instanceof Error ? error.message : String(error)
  const scrubbed = redactSecretText(raw).trim()
  if (!scrubbed) return fallback
  return scrubbed.slice(0, 300)
}
