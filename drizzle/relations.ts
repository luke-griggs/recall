import { relations } from "drizzle-orm/relations";
import { notes, reviews } from "./schema";

export const notesRelations = relations(notes, ({ many }) => ({
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  note: one(notes, {
    fields: [reviews.noteId],
    references: [notes.id],
  }),
}));
