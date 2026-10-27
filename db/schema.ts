/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PostgreSQL schema for hosted multi-user PatchLlama (required in production).
 */

import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const projects = pgTable('projects', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  name: text('name').notNull(),
  repoFullName: text('repo_full_name'),
  defaultBranch: text('default_branch'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  projectId: varchar('project_id', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull(),
  evidenceSource: varchar('evidence_source', { length: 32 }).notNull(),
  workspaceId: varchar('workspace_id', { length: 128 }).notNull(),
  workspaceRoot: text('workspace_root').notNull(),
  commitSha: varchar('commit_sha', { length: 64 }),
  repoFullName: text('repo_full_name'),
  fingerprint: varchar('fingerprint', { length: 128 }),
  payload: jsonb('payload').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patches = pgTable('patches', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  source: varchar('source', { length: 32 }).notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const executions = pgTable('executions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  kind: varchar('kind', { length: 32 }).notNull(),
  command: text('command').notNull(),
  exitCode: integer('exit_code'),
  ok: integer('ok').notNull(),
  durationMs: integer('duration_ms').notNull(),
  stdout: text('stdout').notNull(),
  stderr: text('stderr').notNull(),
  timedOut: integer('timed_out').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditEvents = pgTable('audit_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  detail: text('detail').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
