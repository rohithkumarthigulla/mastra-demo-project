CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "listing_media_mime_type_chk" CHECK ("listing_media"."mime_type" IN ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "listing_media_size_bytes_chk" CHECK ("listing_media"."size_bytes" > 0),
	CONSTRAINT "listing_media_position_chk" CHECK ("listing_media"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_equipment_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."equipment_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_media_listing_position_idx" ON "listing_media" USING btree ("listing_id","position");