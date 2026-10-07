CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "equipment_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"price_per_day" numeric(14, 2) NOT NULL,
	"status" "listing_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_listings_price_chk" CHECK ("equipment_listings"."price_per_day" > 0 AND "equipment_listings"."price_per_day" <= 1000000)
);
--> statement-breakpoint
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_supplier_profile_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_profile_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_model_id_equipment_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."equipment_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_listings" ADD CONSTRAINT "equipment_listings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipment_listings_supplier_profile_id_idx" ON "equipment_listings" USING btree ("supplier_profile_id");--> statement-breakpoint
CREATE INDEX "equipment_listings_status_city_idx" ON "equipment_listings" USING btree ("status","city_id");--> statement-breakpoint
CREATE INDEX "equipment_listings_status_created_at_idx" ON "equipment_listings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "equipment_listings_model_id_idx" ON "equipment_listings" USING btree ("model_id");