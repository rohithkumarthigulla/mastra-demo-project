CREATE TYPE "public"."capability_importance" AS ENUM('REQUIRED', 'PREFERRED', 'OPTIONAL');--> statement-breakpoint
CREATE TYPE "public"."task_suitability" AS ENUM('PRIMARY', 'SECONDARY');--> statement-breakpoint
CREATE TABLE "capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capabilities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "construction_task_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"importance" "capability_importance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "construction_task_capabilities_unique" UNIQUE("task_id","capability_id")
);
--> statement-breakpoint
CREATE TABLE "construction_task_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"suitability" "task_suitability" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "construction_task_categories_unique" UNIQUE("task_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "construction_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "construction_tasks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "equipment_category_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_category_capabilities_unique" UNIQUE("category_id","capability_id"),
	CONSTRAINT "equipment_category_capabilities_status_chk" CHECK ("equipment_category_capabilities"."verification_status" IN ('VERIFIED', 'REVIEW_REQUIRED')),
	CONSTRAINT "equipment_category_capabilities_verified_chk" CHECK ("equipment_category_capabilities"."verification_status" <> 'VERIFIED' OR "equipment_category_capabilities"."source_id" IS NOT NULL),
	CONSTRAINT "equipment_category_capabilities_verified_at_chk" CHECK (("equipment_category_capabilities"."verified_at" IS NOT NULL) = ("equipment_category_capabilities"."verification_status" = 'VERIFIED'))
);
--> statement-breakpoint
CREATE TABLE "equipment_model_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"verification_status" "verification_status" NOT NULL,
	"source_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_model_capabilities_unique" UNIQUE("model_id","capability_id"),
	CONSTRAINT "equipment_model_capabilities_status_chk" CHECK ("equipment_model_capabilities"."verification_status" IN ('VERIFIED', 'REVIEW_REQUIRED')),
	CONSTRAINT "equipment_model_capabilities_verified_chk" CHECK ("equipment_model_capabilities"."verification_status" <> 'VERIFIED' OR "equipment_model_capabilities"."source_id" IS NOT NULL),
	CONSTRAINT "equipment_model_capabilities_verified_at_chk" CHECK (("equipment_model_capabilities"."verified_at" IS NOT NULL) = ("equipment_model_capabilities"."verification_status" = 'VERIFIED'))
);
--> statement-breakpoint
ALTER TABLE "construction_task_capabilities" ADD CONSTRAINT "construction_task_capabilities_task_id_construction_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."construction_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_task_capabilities" ADD CONSTRAINT "construction_task_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_task_categories" ADD CONSTRAINT "construction_task_categories_task_id_construction_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."construction_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "construction_task_categories" ADD CONSTRAINT "construction_task_categories_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_category_capabilities" ADD CONSTRAINT "equipment_category_capabilities_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_category_capabilities" ADD CONSTRAINT "equipment_category_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_category_capabilities" ADD CONSTRAINT "equipment_category_capabilities_source_id_specification_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."specification_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_model_capabilities" ADD CONSTRAINT "equipment_model_capabilities_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_model_capabilities" ADD CONSTRAINT "equipment_model_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_model_capabilities" ADD CONSTRAINT "equipment_model_capabilities_source_id_specification_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."specification_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "construction_task_capabilities_capability_id_idx" ON "construction_task_capabilities" USING btree ("capability_id","importance");--> statement-breakpoint
CREATE INDEX "construction_task_categories_category_id_idx" ON "construction_task_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "equipment_category_capabilities_capability_id_idx" ON "equipment_category_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "equipment_category_capabilities_source_id_idx" ON "equipment_category_capabilities" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "equipment_model_capabilities_capability_id_idx" ON "equipment_model_capabilities" USING btree ("capability_id");--> statement-breakpoint
CREATE INDEX "equipment_model_capabilities_source_id_idx" ON "equipment_model_capabilities" USING btree ("source_id");--> statement-breakpoint
CREATE FUNCTION "equipment_model_capabilities_no_verified_fixture"() RETURNS trigger AS $$
BEGIN
	IF NEW."verification_status" = 'VERIFIED' AND EXISTS (
		SELECT 1 FROM "specification_sources"
		WHERE "id" = NEW."source_id" AND "source_type" = 'TEST_FIXTURE'
	) THEN
		RAISE EXCEPTION 'capability link % cannot be VERIFIED from a TEST_FIXTURE source', NEW."id"
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "equipment_model_capabilities_no_verified_fixture"
	BEFORE INSERT OR UPDATE ON "equipment_model_capabilities"
	FOR EACH ROW EXECUTE FUNCTION "equipment_model_capabilities_no_verified_fixture"();
--> statement-breakpoint
CREATE FUNCTION "equipment_category_capabilities_no_verified_fixture"() RETURNS trigger AS $$
BEGIN
	IF NEW."verification_status" = 'VERIFIED' AND EXISTS (
		SELECT 1 FROM "specification_sources"
		WHERE "id" = NEW."source_id" AND "source_type" = 'TEST_FIXTURE'
	) THEN
		RAISE EXCEPTION 'capability link % cannot be VERIFIED from a TEST_FIXTURE source', NEW."id"
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "equipment_category_capabilities_no_verified_fixture"
	BEFORE INSERT OR UPDATE ON "equipment_category_capabilities"
	FOR EACH ROW EXECUTE FUNCTION "equipment_category_capabilities_no_verified_fixture"();
