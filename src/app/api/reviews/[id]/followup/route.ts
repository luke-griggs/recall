import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db, notes, reviews } from "@/db";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("Follow-up API called");
    const body = await request.json();
    const { message, conversationHistory } = body;
    console.log(
      "Message:",
      message,
      "History length:",
      conversationHistory?.length
    );

    if (!message || typeof message !== "string") {
      console.log("Invalid message");
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    const reviewId = Number(resolvedParams.id);
    console.log("Review ID:", reviewId);
    if (Number.isNaN(reviewId)) {
      return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
    }

    // Fetch review and note details for context
    const [reviewRecord] = await db
      .select({
        id: reviews.id,
        noteId: reviews.noteId,
        questionText: reviews.questionText,
        userAnswer: reviews.userAnswer,
        evaluationFeedback: reviews.evaluationFeedback,
        correct: reviews.correct,
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

    // Build context for the AI
    const systemContext = `You are a kind, knowledgeable professor helping a student understand their learning material. 

Context from the recent review session:
- Original note/concept: ${noteRecord.content}${
      noteRecord.explanation
        ? `\n- Additional context: ${noteRecord.explanation}`
        : ""
    }
- Question asked: ${reviewRecord.questionText}
- Student's answer: ${reviewRecord.userAnswer || "No answer provided"}
- Your evaluation: ${reviewRecord.evaluationFeedback}
- Answer was ${reviewRecord.correct ? "correct" : "incorrect"}

The student now has a follow-up question. Help them deepen their understanding by:
- Providing clear, concise explanations
- Building on what they already know
- Encouraging critical thinking
- Being supportive and patient

Keep your responses focused and helpful.`;

    // Build messages array
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Add conversation history if provided
    if (Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemContext,
      messages: messages,
    });

    const assistantMessage = response.content[0];
    if (assistantMessage.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: assistantMessage.text,
    });
  } catch (error) {
    console.error("Error processing follow-up question:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}
