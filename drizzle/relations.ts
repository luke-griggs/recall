import { relations } from "drizzle-orm/relations";
import { notes, questions, reviews } from "./schema";

export const questionsRelations = relations(questions, ({one, many}) => ({
	note: one(notes, {
		fields: [questions.noteId],
		references: [notes.id]
	}),
	reviews: many(reviews),
}));

export const notesRelations = relations(notes, ({many}) => ({
	questions: many(questions),
	reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({one}) => ({
	question: one(questions, {
		fields: [reviews.questionId],
		references: [questions.id]
	}),
	note: one(notes, {
		fields: [reviews.noteId],
		references: [notes.id]
	}),
}));