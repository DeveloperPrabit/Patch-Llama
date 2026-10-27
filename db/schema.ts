/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * PostgreSQL schema for hosted multi-user PatchLlama (required in production).
 */

import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const projects = pgTable(
  'projects',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 128 }).notNull(),
    name: text('name').notNull(),
    repoFullName: text('repo_full_name'),
    defaultBranch: text('default_branch'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('projects_user_id_idx').on(t.userId)]
)

export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 128 }).notNull(),
    projectId: varchar('project_id', { length: 64 }).references(() => projects.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 32 }).notNull(),
    evidenceSource: varchar('evidence_source', { length: 32 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 128 }).notNull(),
    /** Filesystem hint only — never authorize access from this value alone. */
    workspaceRoot: text('workspace_root').notNull(),
    commitSha: varchar('commit_sha', { length: 64 }),
    repoFullName: text('repo_full_name'),
    fingerprint: varchar('fingerprint', { length: 128 }),
    repairAttempts: integer('repair_attempts').notNull().default(0),
    /** Full DebugSession document (minus secrets). Source of truth for nested state. */
    payload: jsonb('payload').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_user_updated_idx').on(t.userId, t.updatedAt),
    index('sessions_project_id_idx').on(t.projectId),
  ]
)

export const patches = pgTable(
  'patches',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    sessionId: varchar('session_id', { length: 64 })
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull(),
    source: varchar('source', { length: 32 }).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('patches_session_id_idx').on(t.sessionId)]
)

export const executions = pgTable(
  'executions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    sessionId: varchar('session_id', { length: 64 })
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    command: text('command').notNull(),
    exitCode: integer('exit_code'),
    ok: integer('ok').notNull(),
    durationMs: integer('duration_ms').notNull(),
    stdout: text('stdout').notNull(),
    stderr: text('stderr').notNull(),
    timedOut: integer('timed_out').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('executions_session_id_idx').on(t.sessionId)]
)

export const auditEvents = pgTable(
  'audit_events',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    sessionId: varchar('session_id', { length: 64 })
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 64 }).notNull(),
    detail: text('detail').notNull(),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_events_session_id_idx').on(t.sessionId)]
)

export const projectsRelations = relations(projects, ({ many }) => ({
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [sessions.projectId],
    references: [projects.id],
  }),
  patches: many(patches),
  executions: many(executions),
  auditEvents: many(auditEvents),
}))

export const patchesRelations = relations(patches, ({ one }) => ({
  session: one(sessions, {
    fields: [patches.sessionId],
    references: [sessions.id],
  }),
}))

export const executionsRelations = relations(executions, ({ one }) => ({
  session: one(sessions, {
    fields: [executions.sessionId],
    references: [sessions.id],
  }),
}))

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [auditEvents.sessionId],
    references: [sessions.id],
  }),
}))
