/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Server-only Neon/Postgres client. Never import from client components.
 */

import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type PatchllamaDb = PostgresJsDatabase<typeof schema>

type GlobalDb = {
  __patchllamaSql?: ReturnType<typeof postgres>
  __patchllamaDb?: PatchllamaDb
}

const globalForDb = globalThis as unknown as GlobalDb

function requireDatabaseUrl(): string {
  const url = (process.env.DATABASE_URL || '').trim()
  if (!url) {
    const err = new Error(
      'DATABASE_URL is required for PostgreSQL storage. Set the Neon pooled connection string.'
    )
    ;(err as Error & { status: number; code: string }).status = 503
    ;(err as Error & { code: string }).code = 'DATABASE_URL_REQUIRED'
    throw err
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    const err = new Error('DATABASE_URL must be a postgres:// or postgresql:// URL')
    ;(err as Error & { status: number; code: string }).status = 503
    ;(err as Error & { code: string }).code = 'DATABASE_URL_INVALID'
    throw err
  }
  return url
}

/**
 * Reuses a single postgres.js client across hot reloads / serverless invocations
 * in the same isolate. Uses Neon pooler-friendly settings (prepare: false).
 */
export function getSql() {
  if (!globalForDb.__patchllamaSql) {
    const url = requireDatabaseUrl()
    globalForDb.__patchllamaSql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      ssl: 'require',
      // Neon pooler (PgBouncer) does not support prepared statements well.
      prepare: false,
      onnotice: () => undefined,
    })
  }
  return globalForDb.__patchllamaSql
}

export function getDb(): PatchllamaDb {
  if (!globalForDb.__patchllamaDb) {
    globalForDb.__patchllamaDb = drizzle(getSql(), { schema })
  }
  return globalForDb.__patchllamaDb
}

/** Close the pool (tests / scripts). Safe to call if never opened. */
export async function closeDb(): Promise<void> {
  if (globalForDb.__patchllamaSql) {
    await globalForDb.__patchllamaSql.end({ timeout: 5 })
    globalForDb.__patchllamaSql = undefined
    globalForDb.__patchllamaDb = undefined
  }
}
