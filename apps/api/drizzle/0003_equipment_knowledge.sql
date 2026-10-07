CREATE TYPE "public"."equipment_model_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."specification_value_type" AS ENUM('NUMERIC', 'TEXT');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('kg', 't', 'm', 'mm', 'kW', 'hp', 'm3');--> statement-breakpoint
CREATE TABLE "equipment_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "equipment_categories_code_chk" CHECK ("equipment_categories"."code" ~ '^[A-Z][A-Z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "equipment_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"model_name" text NOT NULL,
	"model_code" text,
	"status" "equipment_model_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_specifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"numeric_value" double precision,
	"min_value" double precision,
	"max_value" double precision,
	"unit" "unit",
	"text_value" text,
	"normalized_min" double precision,
	"normalized_max" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_specifications_model_definition_unique" UNIQUE("model_id","definition_id"),
	CONSTRAINT "equipment_specifications_shape_chk" CHECK (("equipment_specifications"."numeric_value" IS NOT NULL AND "equipment_specifications"."min_value" IS NULL AND "equipment_specifications"."max_value" IS NULL AND "equipment_specifications"."unit" IS NOT NULL AND "equipment_specifications"."text_value" IS NULL AND "equipment_specifications"."normalized_min" = "equipment_specifications"."normalized_max")
        OR ("equipment_specifications"."numeric_value" IS NULL AND "equipment_specifications"."min_value" IS NOT NULL AND "equipment_specifications"."max_value" IS NOT NULL AND "equipment_specifications"."unit" IS NOT NULL AND "equipment_specifications"."text_value" IS NULL AND "equipment_specifications"."normalized_min" IS NOT NULL AND "equipment_specifications"."normalized_max" IS NOT NULL)
        OR ("equipment_specifications"."numeric_value" IS NULL AND "equipment_specifications"."min_value" IS NULL AND "equipment_specifications"."max_value" IS NULL AND "equipment_specifications"."unit" IS NULL AND "equipment_specifications"."text_value" IS NOT NULL AND "equipment_specifications"."normalized_min" IS NULL AND "equipment_specifications"."normalized_max" IS NULL)
        OR ("equipment_specifications"."numeric_value" IS NULL AND "equipment_specifications"."min_value" IS NULL AND "equipment_specifications"."max_value" IS NULL AND "equipment_specifications"."unit" IS NULL AND "equipment_specifications"."text_value" IS NULL AND "equipment_specifications"."normalized_min" IS NULL AND "equipment_specifications"."normalized_max" IS NULL)),
	CONSTRAINT "equipment_specifications_numeric_value_chk" CHECK ("equipment_specifications"."numeric_value" IS NULL OR ("equipment_specifications"."numeric_value" >= 0 AND "equipment_specifications"."numeric_value" < 'Infinity'::float8)),
	CONSTRAINT "equipment_specifications_min_value_chk" CHECK ("equipment_specifications"."min_value" IS NULL OR ("equipment_specifications"."min_value" >= 0 AND "equipment_specifications"."min_value" < 'Infinity'::float8)),
	CONSTRAINT "equipment_specifications_max_value_chk" CHECK ("equipment_specifications"."max_value" IS NULL OR ("equipment_specifications"."max_value" >= 0 AND "equipment_specifications"."max_value" < 'Infinity'::float8)),
	CONSTRAINT "equipment_specifications_normalized_min_chk" CHECK ("equipment_specifications"."normalized_min" IS NULL OR ("equipment_specifications"."normalized_min" >= 0 AND "equipment_specifications"."normalized_min" < 'Infinity'::float8)),
	CONSTRAINT "equipment_specifications_normalized_max_chk" CHECK ("equipment_specifications"."normalized_max" IS NULL OR ("equipment_specifications"."normalized_max" >= 0 AND "equipment_specifications"."normalized_max" < 'Infinity'::float8)),
	CONSTRAINT "equipment_specifications_range_chk" CHECK ("equipment_specifications"."min_value" IS NULL OR "equipment_specifications"."max_value" IS NULL OR "equipment_specifications"."min_value" <= "equipment_specifications"."max_value"),
	CONSTRAINT "equipment_specifications_normalized_range_chk" CHECK ("equipment_specifications"."normalized_min" IS NULL OR "equipment_specifications"."normalized_max" IS NULL OR "equipment_specifications"."normalized_min" <= "equipment_specifications"."normalized_max")
);
--> statement-breakpoint
CREATE TABLE "manufacturers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specification_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"value_type" "specification_value_type" NOT NULL,
	"canonical_unit" "unit",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specification_definitions_code_unique" UNIQUE("code"),
	CONSTRAINT "specification_definitions_code_chk" CHECK ("specification_definitions"."code" ~ '^[A-Z][A-Z0-9_]*$'),
	CONSTRAINT "specification_definitions_unit_chk" CHECK (("specification_definitions"."value_type" = 'NUMERIC') = ("specification_definitions"."canonical_unit" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_definition_id_specification_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."specification_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_models_manufacturer_name_lower_idx" ON "equipment_models" USING btree ("manufacturer_id",lower("model_name"));--> statement-breakpoint
CREATE INDEX "equipment_models_category_id_idx" ON "equipment_models" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "equipment_specifications_definition_id_idx" ON "equipment_specifications" USING btree ("definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manufacturers_name_lower_idx" ON "manufacturers" USING btree (lower("name"));--> statement-breakpoint
CREATE FUNCTION "specification_definitions_lock_canonical_unit"() RETURNS trigger AS $$
BEGIN
	IF OLD."canonical_unit" IS NOT NULL AND NEW."canonical_unit" IS DISTINCT FROM OLD."canonical_unit" THEN
		RAISE EXCEPTION 'canonical_unit of specification definition % cannot change', OLD."code"
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "specification_definitions_lock_canonical_unit"
	BEFORE UPDATE ON "specification_definitions"
	FOR EACH ROW EXECUTE FUNCTION "specification_definitions_lock_canonical_unit"();
