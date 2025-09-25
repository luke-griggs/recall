import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { db, notes, reviews } from "@/db";
import { eq } from "drizzle-orm";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const MODEL_NAME = "openai/gpt-oss-20b";

const EVALUATION_PROMPT_TEMPLATE = (
  noteContent: string,
  question: string,
  answer: string
) => `You are a kind professor who is an expert in their field. A few days ago you were working with a student in class and they drew the following conclusion: ${noteContent}

You asked them the following question to check their understanding: ${question}
Here was their answer: ${answer}

If they correctly answered the question, return a json containing {correct: True, message: <let them know you'll ask again soon to check their understanding>}

If their response is mostly correct, but has mistakes, or is missing core ideas, return a json containing {correct: True, Message <a concise explanation on where they missed the mark>

If their response failed to capture the underlying idea correctly, return a json containing {correct: False, Message: <Encouragement and a proper answer to the question>

Keep any encouragement concise, and not too enthusiastic

only return the json object, no other text
`;

function calculateNextReview(
  currentInterval: number,
  easinessFactor: number,
  quality: number
) {
  const newEasinessFactor = Math.max(
    1.3,
    easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  let newInterval: number;
  if (quality < 3) {
    newInterval = 1;
  } else if (currentInterval === 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(currentInterval * newEasinessFactor);
  }

  return {
    newInterval,
    newEasinessFactor: Math.round(newEasinessFactor * 100) / 100,
  };
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { answer } = body;

    if (!answer || typeof answer !== "string") {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    const reviewId = Number(resolvedParams.id);
    if (Number.isNaN(reviewId)) {
      return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
    }

    const [reviewRecord] = await db
      .select({
        id: reviews.id,
        noteId: reviews.noteId,
        questionText: reviews.questionText,
      })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!reviewRecord) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (!reviewRecord.noteId) {
      return NextResponse.json(
        { error: "Review is missing associated note" },
        { status: 400 }
      );
    }

    const [noteRecord] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, reviewRecord.noteId))
      .limit(1);

    if (!noteRecord) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const prompt = EVALUATION_PROMPT_TEMPLATE(
      noteRecord.explanation
        ? `${noteRecord.content}\n\nAdditional context: ${noteRecord.explanation}`
        : noteRecord.content,
      reviewRecord.questionText,
      answer
    );

    const completion = await groq.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      return NextResponse.json(
        { error: "Failed to evaluate answer" },
        { status: 500 }
      );
    }

    let evaluationData: {
      correct?: unknown;
      message?: unknown;
      Message?: unknown;
    };
    try {
      evaluationData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        "Failed to parse evaluation response:",
        parseError,
        responseText
      );
      return NextResponse.json(
        { error: "Failed to evaluate answer" },
        { status: 500 }
      );
    }

    const isCorrect = parseBoolean(evaluationData.correct);
    const message = (
      typeof evaluationData.message === "string"
        ? evaluationData.message
        : typeof evaluationData.Message === "string"
        ? evaluationData.Message
        : ""
    ).trim();

    if (isCorrect === null || !message) {
      return NextResponse.json(
        { error: "Evaluation response incomplete" },
        { status: 500 }
      );
    }

    const quality = isCorrect ? 5 : 2;

    const previousInterval = Number(noteRecord.currentInterval ?? 1) || 1;
    const previousEasinessFactor =
      Number(noteRecord.easinessFactor ?? 2.5) || 2.5;
    const { newInterval, newEasinessFactor } = calculateNextReview(
      previousInterval,
      previousEasinessFactor,
      quality
    );

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    const nowIso = new Date().toISOString();

    await db
      .update(reviews)
      .set({
        userAnswer: answer,
        answeredAt: nowIso,
        evaluationFeedback: message,
        quality,
        correct: isCorrect,
        previousInterval,
        newInterval,
        previousEasinessFactor: previousEasinessFactor.toFixed(2),
        newEasinessFactor: newEasinessFactor.toFixed(2),
      })
      .where(eq(reviews.id, reviewId));

    await db
      .update(notes)
      .set({
        currentInterval: newInterval,
        easinessFactor: newEasinessFactor.toFixed(2),
        reviewCount: (noteRecord.reviewCount ?? 0) + 1,
        consecutiveCorrect: isCorrect
          ? (noteRecord.consecutiveCorrect ?? 0) + 1
          : 0,
        nextReviewAt: nextReviewDate.toISOString(),
        lastReviewedAt: nowIso,
      })
      .where(eq(notes.id, reviewRecord.noteId));

    return NextResponse.json({
      success: true,
      evaluation: {
        feedback: message,
        isCorrect,
        quality,
      },
      scheduling: {
        nextReviewAt: nextReviewDate.toISOString(),
        newInterval,
        newEasinessFactor,
      },
    });
  } catch (error) {
    console.error("Error evaluating review answer:", error);
    return NextResponse.json(
      { error: "Failed to evaluate answer" },
      { status: 500 }
    );
  }
}
