import {
  pgTable,
  check,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  numeric,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Chat/Brain tables
export const conversations = pgTable("conversations", {
  id: uuid().primaryKey().defaultRandom(),
  title: varchar({ length: 255 }).default("New Chat"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid().primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar({ length: 20 }).notNull(), // 'user' or 'assistant'
  content: text().notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
});

export const notes = pgTable(
  "notes",
  {
    id: serial().primaryKey().notNull(),
    content: text().notNull(),
    explanation: text(),
    tags: varchar({ length: 255 }).array(),
    category: varchar({ length: 100 }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    status: varchar({ length: 20 }).default("active"),
    difficultyEstimate: integer("difficulty_estimate"),
    nextReviewAt: timestamp("next_review_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    currentInterval: integer("current_interval").default(1),
    easinessFactor: numeric("easiness_factor", {
      precision: 3,
      scale: 2,
    }).default("2.50"),
    reviewCount: integer("review_count").default(0),
    consecutiveCorrect: integer("consecutive_correct").default(0),
    lastReviewedAt: timestamp("last_reviewed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  () => [
    check(
      "valid_status",
      sql`(status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[])`
    ),
  ]
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial().primaryKey().notNull(),
    noteId: integer("note_id").references(() => notes.id, {
      onDelete: "cascade",
    }),
    generatedAt: timestamp("generated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    questionText: text("question_text").notNull(),
    expectedAnswer: text("expected_answer"),
    modelRubric: text("model_rubric"),
    modelName: varchar("model_name", { length: 100 }),
    generationPrompt: text("generation_prompt"),
    userAnswer: text("user_answer"),
    answeredAt: timestamp("answered_at", {
      withTimezone: true,
      mode: "string",
    }),
    evaluationFeedback: text("evaluation_feedback"),
    quality: integer("quality"),
    correct: boolean("correct"),
    previousInterval: integer("previous_interval"),
    newInterval: integer("new_interval"),
    previousEasinessFactor: numeric("previous_easiness_factor", {
      precision: 3,
      scale: 2,
    }),
    newEasinessFactor: numeric("new_easiness_factor", {
      precision: 3,
      scale: 2,
    }),
  },
  () => []
);
