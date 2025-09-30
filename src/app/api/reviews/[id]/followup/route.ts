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
    const body = await request.json();
    const { message, conversationHistory } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const resolvedParams = await params;
    const reviewId = Number(resolvedParams.id);
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

    // Fetch a few example notes to show the model the format
    const exampleNotes = await db
      .select({
        content: notes.content,
        explanation: notes.explanation,
      })
      .from(notes)
      .where(eq(notes.status, "active"))
      .limit(5);

    // Build context for the AI
    const exampleNotesText =
      exampleNotes.length > 0
        ? `\n\nHere are some examples of the student's existing notes (for reference when creating new notes):\n${exampleNotes
            .map((n, i) => `${i + 1}. "${n.content}"`)
            .join("\n")}`
        : "";

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
${exampleNotesText}

The student now has a follow-up question. Help them deepen their understanding by:
- Providing clear, concise explanations
- Building on what they already know
- Encouraging critical thinking
- Being supportive and patient

IMPORTANT: You have access to a tool to add notes for the student. When the student asks you to add a note (e.g., "can you add that as a note?", "save this concept", "add this to my notes"), use the add_note tool.
- If it's unclear what specific content they want to save, ask them for clarification and offer suggestions
- Look at the example notes above to match their note-taking style
- Keep notes concise but complete - capture the core concept
- Add an explanation if it would help clarify the concept

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

    // Define tools
    const tools = [
      {
        name: "add_note",
        description:
          "Add a new note to the student's learning database. Use this when the student asks to save a concept, add something to their notes, or remember something for later review. IMPORTANT: Always provide a brief message to let the user know you're adding the note before using this tool.",
        input_schema: {
          type: "object" as const,
          properties: {
            content: {
              type: "string" as const,
              description:
                "A concise note that captures the concept with sufficient detail and context. Include the core idea and key points.",
            },
          },
          required: ["content"],
        },
      },
    ];

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const messageStream = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 1024,
            system: systemContext,
            messages: messages,
            tools: tools,
            stream: true,
          });

          let currentToolUse: {
            name: string;
            id: string;
            input: string;
            index: number;
          } | null = null;

          for await (const event of messageStream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text_start" })}\n\n`
                  )
                );
              } else if (event.content_block.type === "tool_use") {
                currentToolUse = {
                  name: event.content_block.name,
                  id: event.content_block.id,
                  input: "",
                  index: event.index,
                };
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_use_start",
                      name: event.content_block.name,
                      id: event.content_block.id,
                    })}\n\n`
                  )
                );
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "text_delta",
                      text: event.delta.text,
                    })}\n\n`
                  )
                );
              } else if (event.delta.type === "input_json_delta") {
                // Accumulate tool input
                if (currentToolUse) {
                  currentToolUse.input += event.delta.partial_json;
                }
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolUse && event.index === currentToolUse.index) {
                // Tool use completed, execute it
                const toolInput = JSON.parse(currentToolUse.input);

                if (currentToolUse.name === "add_note") {
                  const { content } = toolInput;

                  // Add note to database
                  const [newNote] = await db
                    .insert(notes)
                    .values({
                      content,
                      status: "active",
                      nextReviewAt: new Date().toISOString(),
                    })
                    .returning();

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "tool_result",
                        noteId: newNote.id,
                        content,
                      })}\n\n`
                    )
                  );
                }
                currentToolUse = null;
              }
            } else if (event.type === "message_stop") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
            }
          }
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: "Stream error",
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error processing follow-up question:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}
