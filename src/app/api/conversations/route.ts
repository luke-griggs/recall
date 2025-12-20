import { NextRequest, NextResponse } from "next/server";
import { db, conversations } from "@/db";
import { desc } from "drizzle-orm";

// GET all conversations
export async function GET() {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));

    return NextResponse.json(allConversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST create new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = body.title || "New Chat";

    const [newConversation] = await db
      .insert(conversations)
      .values({ title })
      .returning();

    return NextResponse.json(newConversation, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
