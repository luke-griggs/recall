CREATE TABLE "memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now(),
	"last_processed_at" timestamp with time zone
);
