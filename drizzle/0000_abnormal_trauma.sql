CREATE TABLE "audit_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"type" varchar(64) NOT NULL,
	"detail" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"command" text NOT NULL,
	"exit_code" integer,
	"ok" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"stdout" text NOT NULL,
	"stderr" text NOT NULL,
	"timed_out" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patches" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"name" text NOT NULL,
	"repo_full_name" text,
	"default_branch" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"project_id" varchar(64),
	"status" varchar(32) NOT NULL,
	"evidence_source" varchar(32) NOT NULL,
	"workspace_id" varchar(128) NOT NULL,
	"workspace_root" text NOT NULL,
	"commit_sha" varchar(64),
	"repo_full_name" text,
	"fingerprint" varchar(128),
	"repair_attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patches" ADD CONSTRAINT "patches_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_session_id_idx" ON "audit_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "executions_session_id_idx" ON "executions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "patches_session_id_idx" ON "patches" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_updated_idx" ON "sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "sessions_project_id_idx" ON "sessions" USING btree ("project_id");