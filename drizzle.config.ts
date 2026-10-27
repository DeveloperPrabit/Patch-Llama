/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Drizzle Kit config — migrations use DATABASE_URL_UNPOOLED when set, else DATABASE_URL.
 * Never commit real credentials; load from environment only.
 */

import { defineConfig } from 'drizzle-kit'

const url = (
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  ''
)

if (!url) {
  // drizzle-kit reads this at CLI start; allow generate without a live DB.
  // migrate/push will fail clearly if unset.
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: url || 'postgresql://127.0.0.1:5432/patchllama_migrate_placeholder',
  },
  strict: true,
  verbose: true,
})
