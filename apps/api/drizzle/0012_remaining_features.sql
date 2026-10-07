CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."agent_action_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."agent_action_type" AS ENUM('BLOCK_UNIT', 'LIFT_BLOCK', 'UPDATE_LISTING_PRICE', 'REJECT_REQUEST');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('CONFIRMED', 'OUT_FOR_DELIVERY', 'ON_RENT', 'RETURNED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('USER', 'ASSISTANT');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('QUOTE_RECEIVED', 'JOB_VIEWED', 'REQUEST_DECLINED', 'BOOKING_CONFIRMED', 'REQUEST_RECEIVED', 'QUOTE_ACCEPTED', 'QUOTE_LOST', 'REQUEST_WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."notification_tone" AS ENUM('good', 'waiting', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."quote_line_type" AS ENUM('RENTAL', 'TRANSPORT', 'OPERATOR', 'DEPOSIT', 'DISCOUNT');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."rental_request_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('DRAFT', 'OPEN', 'AWARDED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "agent_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_conversations_title_chk" CHECK (char_length("agent_conversations"."title") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"cited_document_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"type" "agent_action_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "agent_action_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_account_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_conversations_title_chk" CHECK (char_length("assistant_conversations"."title") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"recommended_model_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"rental_request_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"equipment_unit_id" uuid NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"builder_account_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'CONFIRMED' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"dispatched_at" timestamp with time zone,
	"rent_started_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_quote_unique" UNIQUE("quote_id"),
	CONSTRAINT "bookings_range_chk" CHECK ("bookings"."end_at" > "bookings"."start_at"),
	CONSTRAINT "bookings_cancel_reason_chk" CHECK ("bookings"."cancel_reason" IS NULL OR char_length("bookings"."cancel_reason") <= 500)
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"embedding_model" text NOT NULL,
	CONSTRAINT "knowledge_chunks_document_position_unique" UNIQUE("document_id","position")
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"language" text NOT NULL,
	"audience" text NOT NULL,
	"domain" text NOT NULL,
	"topic" text NOT NULL,
	"title" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_documents_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"href" text,
	"tone" "notification_tone" NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_href_chk" CHECK ("notifications"."href" IS NULL OR "notifications"."href" LIKE '/%')
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"type" "quote_line_type" NOT NULL,
	"description" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_amount" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "quote_lines_description_chk" CHECK (char_length("quote_lines"."description") BETWEEN 1 AND 200),
	CONSTRAINT "quote_lines_quantity_chk" CHECK ("quote_lines"."quantity" >= 1),
	CONSTRAINT "quote_lines_unit_amount_chk" CHECK ("quote_lines"."unit_amount" >= 0),
	CONSTRAINT "quote_lines_position_chk" CHECK ("quote_lines"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_request_id" uuid NOT NULL,
	"supplier_profile_id" uuid NOT NULL,
	"equipment_unit_id" uuid,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax_percent" numeric(5, 2) NOT NULL,
	"tax_amount" numeric(14, 2) NOT NULL,
	"deposit_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"notes" text,
	"valid_until" date,
	"auto_drafted" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_tax_percent_chk" CHECK ("quotes"."tax_percent" >= 0),
	CONSTRAINT "quotes_amounts_chk" CHECK ("quotes"."tax_amount" >= 0 AND "quotes"."deposit_amount" >= 0),
	CONSTRAINT "quotes_notes_chk" CHECK ("quotes"."notes" IS NULL OR char_length("quotes"."notes") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "rate_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"week_rate" numeric(14, 2),
	"month_rate" numeric(14, 2),
	"transport_fee" numeric(14, 2),
	"operator_rate_per_day" numeric(14, 2),
	"deposit_amount" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_cards_listing_unique" UNIQUE("listing_id"),
	CONSTRAINT "rate_cards_amounts_chk" CHECK (coalesce("rate_cards"."week_rate", 0) >= 0 AND coalesce("rate_cards"."month_rate", 0) >= 0 AND coalesce("rate_cards"."transport_fee", 0) >= 0 AND coalesce("rate_cards"."operator_rate_per_day", 0) >= 0 AND coalesce("rate_cards"."deposit_amount", 0) >= 0)
);
--> statement-breakpoint
CREATE TABLE "rental_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"builder_account_id" uuid NOT NULL,
	"requirement_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"message" text,
	"status" "rental_request_status" DEFAULT 'PENDING' NOT NULL,
	"decline_reason" text,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_requests_dates_chk" CHECK ("rental_requests"."end_date" >= "rental_requests"."start_date"),
	CONSTRAINT "rental_requests_message_chk" CHECK ("rental_requests"."message" IS NULL OR char_length("rental_requests"."message") <= 1000),
	CONSTRAINT "rental_requests_decline_reason_chk" CHECK ("rental_requests"."decline_reason" IS NULL OR char_length("rental_requests"."decline_reason") <= 500)
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"builder_account_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category_id" uuid NOT NULL,
	"equipment_model_id" uuid,
	"construction_task_id" uuid,
	"city_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"budget_per_day" numeric(14, 2),
	"notes" text,
	"status" "requirement_status" DEFAULT 'DRAFT' NOT NULL,
	"sent_at" timestamp with time zone,
	"awarded_quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirements_title_chk" CHECK (char_length("requirements"."title") BETWEEN 3 AND 120),
	CONSTRAINT "requirements_dates_chk" CHECK ("requirements"."end_date" >= "requirements"."start_date"),
	CONSTRAINT "requirements_quantity_chk" CHECK ("requirements"."quantity" BETWEEN 1 AND 20),
	CONSTRAINT "requirements_budget_chk" CHECK ("requirements"."budget_per_day" IS NULL OR ("requirements"."budget_per_day" > 0 AND "requirements"."budget_per_day" <= 1000000)),
	CONSTRAINT "requirements_notes_chk" CHECK ("requirements"."notes" IS NULL OR char_length("requirements"."notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_supplier_profile_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_profile_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_actions" ADD CONSTRAINT "agent_pending_actions_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_builder_account_id_accounts_id_fk" FOREIGN KEY ("builder_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rental_request_id_rental_requests_id_fk" FOREIGN KEY ("rental_request_id") REFERENCES "public"."rental_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_equipment_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."equipment_listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_equipment_unit_id_equipment_units_id_fk" FOREIGN KEY ("equipment_unit_id") REFERENCES "public"."equipment_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_supplier_profile_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_profile_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_builder_account_id_accounts_id_fk" FOREIGN KEY ("builder_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rental_request_id_rental_requests_id_fk" FOREIGN KEY ("rental_request_id") REFERENCES "public"."rental_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supplier_profile_id_supplier_profiles_id_fk" FOREIGN KEY ("supplier_profile_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_equipment_unit_id_equipment_units_id_fk" FOREIGN KEY ("equipment_unit_id") REFERENCES "public"."equipment_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_listing_id_equipment_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."equipment_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_listing_id_equipment_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."equipment_listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_builder_account_id_accounts_id_fk" FOREIGN KEY ("builder_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_builder_account_id_accounts_id_fk" FOREIGN KEY ("builder_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_category_id_equipment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."equipment_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_equipment_model_id_equipment_models_id_fk" FOREIGN KEY ("equipment_model_id") REFERENCES "public"."equipment_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_construction_task_id_construction_tasks_id_fk" FOREIGN KEY ("construction_task_id") REFERENCES "public"."construction_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_awarded_quote_id_quotes_id_fk" FOREIGN KEY ("awarded_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_conversations_supplier_updated_idx" ON "agent_conversations" USING btree ("supplier_profile_id","updated_at");--> statement-breakpoint
CREATE INDEX "agent_messages_conversation_created_idx" ON "agent_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_pending_actions_conversation_status_idx" ON "agent_pending_actions" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "assistant_conversations_builder_updated_idx" ON "assistant_conversations" USING btree ("builder_account_id","updated_at");--> statement-breakpoint
CREATE INDEX "assistant_messages_conversation_created_idx" ON "assistant_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_supplier_status_idx" ON "bookings" USING btree ("supplier_profile_id","status");--> statement-breakpoint
CREATE INDEX "bookings_builder_status_idx" ON "bookings" USING btree ("builder_account_id","status");--> statement-breakpoint
CREATE INDEX "bookings_unit_status_idx" ON "bookings" USING btree ("equipment_unit_id","status");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "notifications_account_created_at_idx" ON "notifications" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_lines_quote_position_idx" ON "quote_lines" USING btree ("quote_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_one_open_per_request" ON "quotes" USING btree ("rental_request_id") WHERE "quotes"."status" NOT IN ('REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE INDEX "quotes_rental_request_idx" ON "quotes" USING btree ("rental_request_id");--> statement-breakpoint
CREATE INDEX "quotes_supplier_status_idx" ON "quotes" USING btree ("supplier_profile_id","status");--> statement-breakpoint
CREATE INDEX "rental_requests_listing_status_idx" ON "rental_requests" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "rental_requests_builder_status_idx" ON "rental_requests" USING btree ("builder_account_id","status");--> statement-breakpoint
CREATE INDEX "rental_requests_requirement_idx" ON "rental_requests" USING btree ("requirement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_requests_requirement_listing_idx" ON "rental_requests" USING btree ("requirement_id","listing_id") WHERE "rental_requests"."requirement_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "requirements_builder_status_idx" ON "requirements" USING btree ("builder_account_id","status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("equipment_unit_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&) WHERE ("status" IN ('CONFIRMED', 'OUT_FOR_DELIVERY', 'ON_RENT'));
