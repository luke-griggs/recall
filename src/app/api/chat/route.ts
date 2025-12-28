import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db, messages, conversations, memory } from "@/db";
import { eq, desc } from "drizzle-orm";

const anthropic = new Anthropic();

// Build system prompt with memory context
async function buildSystemPrompt(): Promise<string | undefined> {
  try {
    const [currentMemory] = await db
      .select()
      .from(memory)
      .orderBy(desc(memory.lastUpdatedAt))
      .limit(1);

    if (!currentMemory?.content) {
      return undefined;
    }

    return `

<user_context>
${currentMemory.content}
</user_context>

Use this context naturally in your responses when relevant. Don't explicitly mention that you have this memory unless asked.

For mathematical expressions, use LaTeX:
- Inline math: $...$ (e.g., "the function $f(x)$ is...")
- Display math: put $$ on separate lines like this:

$$
\\int_a^b f(x)\\,dx = \\lim_{n \\to \\infty} \\sum_{i=1}^n f(x_i^*) \\Delta x
$$

Display math must have $$ on its own line, with the equation on the next line(s), and closing $$ on its own line. This ensures proper centering and large symbols.`;
  } catch (error) {
    console.error("Error building system prompt:", error);
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, message } = await request.json();

    if (!conversationId || !message) {
      return new Response(
        JSON.stringify({ error: "Missing conversationId or message" }),
        { status: 400 }
      );
    }

    // Save user message
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: message,
    });

    // Get conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Format messages for Anthropic
    const anthropicMessages = history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Build system prompt with memory context
    const systemPrompt = await buildSystemPrompt();

    // Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: systemPrompt,
            messages: anthropicMessages,
            stream: true,
            temperature: 0.6,
          });

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }

          // Save assistant message after streaming completes
          await db.insert(messages).values({
            conversationId,
            role: "assistant",
            content: fullResponse,
          });

          // Update conversation title if it's the first exchange
          if (history.length === 1) {
            // Generate a title from the first message
            const titleResponse = await anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 50,
              messages: [
                {
                  role: "user",
                  content: `Generate a very short title (3-5 words max) for a conversation that starts with: "${message.substring(
                    0,
                    100
                  )}". Just respond with the title, nothing else.`,
                },
              ],
            });

            const title =
              titleResponse.content[0].type === "text"
                ? titleResponse.content[0].text.trim()
                : "New Chat";

            await db
              .update(conversations)
              .set({ title, updatedAt: new Date().toISOString() })
              .where(eq(conversations.id, conversationId));

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ title })}\n\n`)
            );
          }

          // Update conversation timestamp
          await db
            .update(conversations)
            .set({ updatedAt: new Date().toISOString() })
            .where(eq(conversations.id, conversationId));

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
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
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), {
      status: 500,
    });
  }
}
