-- This baseline is intentionally adoptable by databases previously managed with
-- `drizzle-kit push`. IF NOT EXISTS preserves those objects while allowing a
-- brand-new database to be created entirely from committed migrations.
CREATE TABLE IF NOT EXISTS "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"checked" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lists" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'items_list_id_lists_id_fk'
			AND conrelid = 'public.items'::regclass
	) THEN
		ALTER TABLE "items" ADD CONSTRAINT "items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'lists_group_id_groups_id_fk'
			AND conrelid = 'public.lists'::regclass
	) THEN
		ALTER TABLE "lists" ADD CONSTRAINT "lists_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE cascade;
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_list_id_idx" ON "items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lists_group_id_idx" ON "lists" USING btree ("group_id");
