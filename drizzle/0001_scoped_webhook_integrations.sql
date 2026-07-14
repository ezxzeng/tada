-- IF NOT EXISTS lets this migration adopt the table if this schema change was
-- pushed before the repository switched to committed migrations.
CREATE TABLE IF NOT EXISTS "webhook_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"list_id" text NOT NULL,
	"name" text NOT NULL,
	"actions" jsonb NOT NULL,
	"secret_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"rate_window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rate_window_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'webhook_integrations_group_id_groups_id_fk'
			AND conrelid = 'public.webhook_integrations'::regclass
	) THEN
		ALTER TABLE "webhook_integrations" ADD CONSTRAINT "webhook_integrations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE cascade;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'webhook_integrations_list_id_lists_id_fk'
			AND conrelid = 'public.webhook_integrations'::regclass
	) THEN
		ALTER TABLE "webhook_integrations" ADD CONSTRAINT "webhook_integrations_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_integrations_group_id_idx" ON "webhook_integrations" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_integrations_list_id_idx" ON "webhook_integrations" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_integrations_secret_hash_idx" ON "webhook_integrations" USING btree ("secret_hash");
