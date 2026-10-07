ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_id_supplier_unique" UNIQUE("id","supplier_profile_id");--> statement-breakpoint
CREATE TYPE "public"."asset_identifier_type" AS ENUM('SERIAL_NUMBER', 'REGISTRATION_NUMBER', 'ENGINE_NUMBER');--> statement-breakpoint
CREATE TYPE "public"."unit_condition" AS ENUM('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('ACTIVE', 'RETIRED');--> statement-breakpoint
CREATE TABLE "asset_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"type" "asset_identifier_type" NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "asset_identifiers_unit_type_unique" UNIQUE("unit_id","type"),
	CONSTRAINT "asset_identifiers_value_chk" CHECK (char_length("asset_identifiers"."value") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "equipment_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"yard_id" uuid NOT NULL,
	"model_year" integer NOT NULL,
	"condition" "unit_condition" NOT NULL,
	"label" text,
	"status" "unit_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_units_id_supplier_unique" UNIQUE("id","supplier_profile_id"),
	CONSTRAINT "equipment_units_model_year_chk" CHECK ("equipment_units"."model_year" BETWEEN 1950 AND 2100),
	CONSTRAINT "equipment_units_label_chk" CHECK (char_length("equipment_units"."label") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "yards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city_id" uuid NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "yards_id_supplier_unique" UNIQUE("id","supplier_profile_id"),
	CONSTRAINT "yards_name_chk" CHECK (char_length("yards"."name") BETWEEN 1 AND 80),
	CONSTRAINT "yards_address_chk" CHECK (char_length("yards"."address") <= 300)
);
--> statement-breakpoint
ALTER TABLE "asset_identifiers" ADD CONSTRAINT "asset_identifiers_unit_fk" FOREIGN KEY ("unit_id","supplier_profile_id") REFERENCES "public"."equipment_units"("id","supplier_profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_supplier_profile_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_profile_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_listing_fk" FOREIGN KEY ("listing_id","supplier_profile_id") REFERENCES "public"."equipment_listings"("id","supplier_profile_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_yard_fk" FOREIGN KEY ("yard_id","supplier_profile_id") REFERENCES "public"."yards"("id","supplier_profile_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yards" ADD CONSTRAINT "yards_supplier_profile_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_profile_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yards" ADD CONSTRAINT "yards_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_identifiers_supplier_type_value_idx" ON "asset_identifiers" USING btree ("supplier_profile_id","type",lower("value"));--> statement-breakpoint
CREATE INDEX "equipment_units_supplier_status_idx" ON "equipment_units" USING btree ("supplier_profile_id","status");--> statement-breakpoint
CREATE INDEX "equipment_units_listing_status_idx" ON "equipment_units" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "equipment_units_yard_status_idx" ON "equipment_units" USING btree ("yard_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "yards_supplier_name_idx" ON "yards" USING btree ("supplier_profile_id",lower("name"));
