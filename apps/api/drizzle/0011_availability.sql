CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."block_reason" AS ENUM('MAINTENANCE', 'TRANSPORT', 'HELD_BACK');--> statement-breakpoint
CREATE TYPE "public"."block_status" AS ENUM('ACTIVE', 'LIFTED');--> statement-breakpoint
CREATE TABLE "maintenance_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"reason" "block_reason" NOT NULL,
	"status" "block_status" DEFAULT 'ACTIVE' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_blocks_range_chk" CHECK ("maintenance_blocks"."end_at" > "maintenance_blocks"."start_at"),
	CONSTRAINT "maintenance_blocks_note_chk" CHECK ("maintenance_blocks"."note" IS NULL OR char_length("maintenance_blocks"."note") <= 500)
);
--> statement-breakpoint
ALTER TABLE "maintenance_blocks" ADD CONSTRAINT "maintenance_blocks_unit_id_equipment_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."equipment_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_blocks" ADD CONSTRAINT "maintenance_blocks_created_by_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_blocks_unit_status_idx" ON "maintenance_blocks" USING btree ("unit_id","status");--> statement-breakpoint
ALTER TABLE "maintenance_blocks" ADD CONSTRAINT "maintenance_blocks_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&) WHERE ("status" = 'ACTIVE');
