CREATE TYPE "public"."document_kind" AS ENUM('markdown', 'text', 'code');--> statement-breakpoint
CREATE TYPE "public"."link_kind" AS ENUM('chatgpt', 'youtube', 'article', 'other');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sync_trigger" AS ENUM('manual', 'schedule', 'cli');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"ordinal" integer NOT NULL,
	"heading_path" text[] NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"embedding" vector(768),
	"embed_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"path" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"title" text NOT NULL,
	"content_hash" text NOT NULL,
	"problem_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"chunk_id" integer NOT NULL,
	"url" text NOT NULL,
	"kind" "link_kind" NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"branch" text NOT NULL,
	"description" text,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_indexed_sha" text,
	"config_hash" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repos_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"trigger" "sync_trigger" NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"from_sha" text,
	"to_sha" text,
	"files_changed" integer DEFAULT 0 NOT NULL,
	"chunks_added" integer DEFAULT 0 NOT NULL,
	"chunks_removed" integer DEFAULT 0 NOT NULL,
	"chunks_embedded" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "chunks_content_hash_idx" ON "chunks" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_repo_path_idx" ON "documents" USING btree ("repo_id","path");--> statement-breakpoint
CREATE INDEX "documents_problem_key_idx" ON "documents" USING btree ("problem_key");--> statement-breakpoint
CREATE INDEX "links_chunk_idx" ON "links" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "links_url_idx" ON "links" USING btree ("url");--> statement-breakpoint
CREATE INDEX "sync_runs_repo_started_idx" ON "sync_runs" USING btree ("repo_id","started_at");