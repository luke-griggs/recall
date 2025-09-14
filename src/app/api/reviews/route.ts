import { NextRequest, NextResponse } from "next/server";
import { db, reviews, questions } from "@/db";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

type ReviewInsert = InferInsertModel<typeof reviews>;

// Simple spaced repetition algorithm based on SM-2
function calculateNextReview(
  currentInterval: number,
  easinessFactor: number,
  quality: number // 0-5 scale (0: complete blackout, 5: perfect response)
) {
  const newEasinessFactor = Math.max(
    1.3,
    easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  let newInterval;
  if (quality < 3) {
    newInterval = 1; // Reset to 1 day if quality is poor
  } else {
    if (currentInterval === 1) {
      newInterval = 6; // First successful review -> 6 days
    } else {
      newInterval = Math.round(currentInterval * newEasinessFactor);
    }
  }

  return {
    newInterval,
    newEasinessFactor: Math.round(newEasinessFactor * 100) / 100,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, userResponse, quality } = body;

    if (!questionId || quality === undefined) {
      return NextResponse.json(
        { error: "Question ID and quality rating are required" },
        { status: 400 }
      );
    }

    // Get current question data
    const [currentQuestion] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!currentQuestion) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Calculate next review parameters
    const { newInterval, newEasinessFactor } = calculateNextReview(
      currentQuestion.currentInterval || 1,
      parseFloat(currentQuestion.easinessFactor || "2.50"),
      quality
    );

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    const isCorrect = quality >= 3;

    // Create review record
    const reviewData: ReviewInsert = {
      questionId: questionId,
      noteId: currentQuestion.noteId,
      userResponse: userResponse,
      correct: isCorrect,
      previousInterval: currentQuestion.currentInterval,
      newInterval: newInterval,
      previousEasinessFactor: parseFloat(
        currentQuestion.easinessFactor || "2.50"
      ).toString(),
      newEasinessFactor: newEasinessFactor.toString(),
    };

    const [newReview] = await db.insert(reviews).values(reviewData).returning();

    // Update question with new spaced repetition data
    await db
      .update(questions)
      .set({
        nextReviewDate: nextReviewDate.toISOString(),
        currentInterval: newInterval,
        easinessFactor: newEasinessFactor.toString(),
        reviewCount: (currentQuestion.reviewCount || 0) + 1,
        consecutiveCorrect: isCorrect
          ? (currentQuestion.consecutiveCorrect || 0) + 1
          : 0,
      })
      .where(eq(questions.id, questionId));

    return NextResponse.json({
      review: newReview,
      nextReviewDate: nextReviewDate.toISOString(),
      newInterval,
      newEasinessFactor,
      success: true,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
