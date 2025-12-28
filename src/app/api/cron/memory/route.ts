import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db, memory, conversations, messages } from "@/db";
import { desc, eq, gt } from "drizzle-orm";

const anthropic = new Anthropic();

const MEMORY_UPDATE_PROMPT = `You are a memory management system. Your job is to maintain a coherent, up-to-date memory about a user based on their conversations.

## Memory Format

The memory should follow this structure (using markdown headers):

**Work context**
Professional background, income, current/past work projects, skills being used professionally.

**Personal context**
Age, education, interests, hobbies, personality traits, values, what they enjoy.

**Top of mind**
What they're currently focused on right now - active projects, current coursework, immediate goals, things they're actively exploring.

**Brief history**
*Recent months* - What they've been engaged with recently.
*Earlier context* - Patterns and interests from before that.

**Long-term background**
Enduring traits, learning style, intellectual tendencies, consistent patterns across time.

## Update Rules

1. **Be conservative with changes** - Only update the memory when there's genuinely new, meaningful information. Don't rewrite sections that don't need changing.

2. **Preserve existing information** - Don't remove facts unless they're clearly outdated or contradicted. Information about someone's background, interests, or past experiences remains relevant.

3. **Move information through time** - As time passes, "Top of mind" items may move to "Recent months", and "Recent months" may move to "Earlier context". Only current active focuses belong in "Top of mind".

4. **Add specifics when learned** - If you learn concrete details (specific courses, project names, technologies, etc.), include them.

5. **Maintain narrative coherence** - The memory should read naturally, like a brief but comprehensive profile of the person.

6. **Don't invent or assume** - Only include information that was explicitly stated or clearly implied in conversations.

7. **Keep appropriate length** - Each section should be 1-3 short paragraphs. Be concise but comprehensive.

## Your Task

Given the current memory and recent conversations, output an updated memory. If no meaningful updates are needed, you may return the memory unchanged or with only minor refinements.

Output ONLY the updated memory content in the format above (starting with **Work context**). No additional commentary.`;

// Verify the cron secret to prevent unauthorized access
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is configured, allow in development
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// GET - Cron endpoint for daily memory updates (Vercel Cron uses GET)
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get existing memory
    const [existingMemory] = await db
      .select()
      .from(memory)
      .orderBy(desc(memory.lastUpdatedAt))
      .limit(1);

    // Determine which conversations to process
    let conversationsToProcess;
    if (existingMemory?.lastProcessedAt) {
      // Get conversations since last processing
      conversationsToProcess = await db
        .select()
        .from(conversations)
        .where(gt(conversations.updatedAt, existingMemory.lastProcessedAt))
        .orderBy(desc(conversations.updatedAt))
        .limit(30);
    } else {
      // First time - get all recent conversations
      conversationsToProcess = await db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.updatedAt))
        .limit(50);
    }

    // Get messages for each conversation
    const conversationData = await Promise.all(
      conversationsToProcess.map(async (conv) => {
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(messages.createdAt);
        return {
          title: conv.title,
          date: conv.updatedAt,
          messages: msgs,
        };
      })
    );

    // Filter out empty conversations
    const nonEmptyConversations = conversationData.filter(
      (c) => c.messages.length > 0
    );

    // If no new conversations and we have existing memory, skip
    if (nonEmptyConversations.length === 0 && existingMemory) {
      return NextResponse.json({
        message: "No new conversations to process",
        updated: false,
      });
    }

    // Format conversations - focus on user messages
    const conversationSummaries = nonEmptyConversations
      .map((conv) => {
        const userMessages = conv.messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n\n");
        return `[${conv.date?.split("T")[0] || "Unknown date"}] ${
          conv.title
        }\n${userMessages}`;
      })
      .join("\n\n---\n\n");

    const currentMemoryText = existingMemory?.content || "No existing memory.";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `${MEMORY_UPDATE_PROMPT}

## Current Memory

${currentMemoryText}

## Recent Conversations

${conversationSummaries || "No conversations to process."}

## Updated Memory`,
        },
      ],
    });

    const updatedContent =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";

    if (!updatedContent) {
      return NextResponse.json(
        { error: "Failed to generate memory content" },
        { status: 500 }
      );
    }

    // Save the updated memory
    const now = new Date().toISOString();

    if (existingMemory) {
      await db
        .update(memory)
        .set({
          content: updatedContent,
          lastUpdatedAt: now,
          lastProcessedAt: now,
        })
        .where(eq(memory.id, existingMemory.id));
    } else {
      await db.insert(memory).values({
        content: updatedContent,
        lastUpdatedAt: now,
        lastProcessedAt: now,
      });
    }

    return NextResponse.json({
      message: "Memory updated successfully",
      conversationsProcessed: nonEmptyConversations.length,
      updated: true,
    });
  } catch (error) {
    console.error("Cron memory update error:", error);
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 }
    );
  }
}
