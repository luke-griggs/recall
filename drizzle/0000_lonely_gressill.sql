-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"explanation" text,
	"tags" varchar(255)[],
	"created_at" timestamp with time zone DEFAULT now(),
	"status" varchar(20) DEFAULT 'active',
	"difficulty_estimate" integer,
	CONSTRAINT "valid_status" CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer,
	"question_text" text NOT NULL,
	"expected_answer" text,
	"question_type" varchar(50) DEFAULT 'recall',
	"generated_by_model" varchar(100),
	"generation_prompt" text,
	"generated_at" timestamp with time zone DEFAULT now(),
	"next_review_date" timestamp with time zone DEFAULT now(),
	"current_interval" integer DEFAULT 1,
	"easiness_factor" numeric(3, 2) DEFAULT '2.50',
	"review_count" integer DEFAULT 0,
	"consecutive_correct" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active',
	CONSTRAINT "valid_easiness_factor" CHECK (easiness_factor >= 1.30),
	CONSTRAINT "valid_status" CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[])),
	CONSTRAINT "valid_question_type" CHECK ((question_type)::text = ANY ((ARRAY['recall'::character varying, 'multiple_choice'::character varying, 'fill_blank'::character varying, 'true_false'::character varying, 'application'::character varying, 'conceptual'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer,
	"note_id" integer,
	"reviewed_at" timestamp with time zone DEFAULT now(),
	"user_response" text,
	"correct" boolean,
	"previous_interval" integer,
	"new_interval" integer,
	"previous_easiness_factor" numeric(3, 2),
	"new_easiness_factor" numeric(3, 2)
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
*/