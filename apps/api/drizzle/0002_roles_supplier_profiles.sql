CREATE TYPE "public"."account_role" AS ENUM('SUPPLIER', 'BUILDER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "supplier_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_profiles_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "role" "account_role" DEFAULT 'BUILDER' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;