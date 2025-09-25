ALTER TABLE "reviews" RENAME COLUMN "reviewed_at" TO "generated_at";
ALTER TABLE "reviews" RENAME COLUMN "user_response" TO "user_answer";

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "question_text" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "expected_answer" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "model_rubric" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "model_name" varchar(100);
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "generation_prompt" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "answered_at" timestamp with time zone;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "evaluation_feedback" text;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "quality" integer;

UPDATE "reviews" AS r
SET question_text = q.question_text,
    expected_answer = q.expected_answer,
    model_name = q.generated_by_model,
    generation_prompt = q.generation_prompt
FROM "questions" AS q
WHERE r.question_id = q.id
  AND (r.question_text IS NULL OR r.expected_answer IS NULL OR r.model_name IS NULL OR r.generation_prompt IS NULL);

UPDATE "reviews"
SET question_text = COALESCE(question_text, 'Unknown question');

ALTER TABLE "reviews" ALTER COLUMN "question_text" SET NOT NULL;

UPDATE "reviews"
SET answered_at = generated_at
WHERE answered_at IS NULL;

ALTER TABLE "reviews" DROP COLUMN IF EXISTS "question_id";

ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "next_review_at" timestamp with time zone DEFAULT now();
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "current_interval" integer DEFAULT 1;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "easiness_factor" numeric(3, 2) DEFAULT '2.50';
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "review_count" integer DEFAULT 0;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "consecutive_correct" integer DEFAULT 0;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "last_reviewed_at" timestamp with time zone;

WITH latest_question AS (
    SELECT DISTINCT ON (note_id) *
    FROM "questions"
    ORDER BY note_id, generated_at DESC
)
UPDATE "notes" AS n
SET next_review_at = COALESCE(lq.next_review_date, n.next_review_at),
    current_interval = COALESCE(lq.current_interval, n.current_interval),
    easiness_factor = COALESCE(lq.easiness_factor, n.easiness_factor),
    review_count = COALESCE(lq.review_count, n.review_count),
    consecutive_correct = COALESCE(lq.consecutive_correct, n.consecutive_correct)
FROM latest_question AS lq
WHERE lq.note_id = n.id;

WITH latest_review AS (
    SELECT note_id, MAX(generated_at) AS last_reviewed_at
    FROM "reviews"
    GROUP BY note_id
)
UPDATE "notes" AS n
SET last_reviewed_at = lr.last_reviewed_at
FROM latest_review AS lr
WHERE lr.note_id = n.id;

DROP TABLE IF EXISTS "questions";
