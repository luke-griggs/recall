import { pgTable, check, serial, text, varchar, timestamp, integer, foreignKey, numeric, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const notes = pgTable("notes", {
	id: serial().primaryKey().notNull(),
	content: text().notNull(),
	explanation: text(),
	tags: varchar({ length: 255 }).array(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	status: varchar({ length: 20 }).default('active'),
	difficultyEstimate: integer("difficulty_estimate"),
}, (table) => [
	check("valid_status", sql`(status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[])`),
]);

export const questions = pgTable("questions", {
	id: serial().primaryKey().notNull(),
	noteId: integer("note_id"),
	questionText: text("question_text").notNull(),
	expectedAnswer: text("expected_answer"),
	questionType: varchar("question_type", { length: 50 }).default('recall'),
	generatedByModel: varchar("generated_by_model", { length: 100 }),
	generationPrompt: text("generation_prompt"),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	nextReviewDate: timestamp("next_review_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	currentInterval: integer("current_interval").default(1),
	easinessFactor: numeric("easiness_factor", { precision: 3, scale:  2 }).default('2.50'),
	reviewCount: integer("review_count").default(0),
	consecutiveCorrect: integer("consecutive_correct").default(0),
	status: varchar({ length: 20 }).default('active'),
}, (table) => [
	foreignKey({
			columns: [table.noteId],
			foreignColumns: [notes.id],
			name: "questions_note_id_fkey"
		}).onDelete("cascade"),
	check("valid_easiness_factor", sql`easiness_factor >= 1.30`),
	check("valid_status", sql`(status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[])`),
	check("valid_question_type", sql`(question_type)::text = ANY ((ARRAY['recall'::character varying, 'multiple_choice'::character varying, 'fill_blank'::character varying, 'true_false'::character varying, 'application'::character varying, 'conceptual'::character varying])::text[])`),
]);

export const reviews = pgTable("reviews", {
	id: serial().primaryKey().notNull(),
	questionId: integer("question_id"),
	noteId: integer("note_id"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userResponse: text("user_response"),
	correct: boolean(),
	previousInterval: integer("previous_interval"),
	newInterval: integer("new_interval"),
	previousEasinessFactor: numeric("previous_easiness_factor", { precision: 3, scale:  2 }),
	newEasinessFactor: numeric("new_easiness_factor", { precision: 3, scale:  2 }),
}, (table) => [
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "reviews_question_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.noteId],
			foreignColumns: [notes.id],
			name: "reviews_note_id_fkey"
		}).onDelete("cascade"),
]);
