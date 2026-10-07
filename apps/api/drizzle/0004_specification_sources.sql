CREATE TYPE "public"."specification_source_type" AS ENUM('MANUFACTURER', 'LICENSED_DATASET', 'APPROVED_PUBLIC_SOURCE', 'INTERNAL_VERIFICATION', 'TEST_FIXTURE');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('VERIFIED', 'REVIEW_REQUIRED', 'UNKNOWN', 'DEPRECATED');--> statement-breakpoint
CREATE TABLE "specification_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "specification_source_type" NOT NULL,
	"source_name" text NOT NULL,
	"reference_url" text,
	"document_name" text,
	"retrieved_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD COLUMN "verification_status" "verification_status";--> statement-breakpoint
-- Backfill: nothing existing is verified. Rows with a value need review; empty rows are unknown.
UPDATE "equipment_specifications" SET "verification_status" = CASE
	WHEN "numeric_value" IS NULL AND "min_value" IS NULL AND "max_value" IS NULL AND "text_value" IS NULL THEN 'UNKNOWN'::"verification_status"
	ELSE 'REVIEW_REQUIRED'::"verification_status"
END WHERE "verification_status" IS NULL;--> statement-breakpoint
ALTER TABLE "equipment_specifications" ALTER COLUMN "verification_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "specification_sources_type_name_lower_idx" ON "specification_sources" USING btree ("source_type",lower("source_name"));--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_source_id_specification_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."specification_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_specifications_source_id_idx" ON "equipment_specifications" USING btree ("source_id");--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_unknown_chk" CHECK (("equipment_specifications"."verification_status" = 'UNKNOWN') = ("equipment_specifications"."numeric_value" IS NULL AND "equipment_specifications"."min_value" IS NULL AND "equipment_specifications"."max_value" IS NULL AND "equipment_specifications"."text_value" IS NULL));--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_verified_chk" CHECK ("equipment_specifications"."verification_status" <> 'VERIFIED' OR "equipment_specifications"."source_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_verified_at_chk" CHECK (("equipment_specifications"."verified_at" IS NOT NULL) = ("equipment_specifications"."verification_status" = 'VERIFIED'));--> statement-breakpoint
CREATE FUNCTION "equipment_specifications_no_verified_fixture"() RETURNS trigger AS $$
BEGIN
	IF NEW."verification_status" = 'VERIFIED' AND EXISTS (
		SELECT 1 FROM "specification_sources"
		WHERE "id" = NEW."source_id" AND "source_type" = 'TEST_FIXTURE'
	) THEN
		RAISE EXCEPTION 'specification % cannot be VERIFIED from a TEST_FIXTURE source', NEW."id"
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "equipment_specifications_no_verified_fixture"
	BEFORE INSERT OR UPDATE ON "equipment_specifications"
	FOR EACH ROW EXECUTE FUNCTION "equipment_specifications_no_verified_fixture"();
