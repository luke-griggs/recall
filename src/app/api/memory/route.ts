import { NextRequest, NextResponse } from "next/server";
import { db, memory } from "@/db";
import { desc, eq } from "drizzle-orm";

// GET - Retrieve current memory
export async function GET() {
  try {
    const [currentMemory] = await db
      .select()
      .from(memory)
      .orderBy(desc(memory.lastUpdatedAt))
      .limit(1);

    return NextResponse.json(currentMemory || null);
  } catch (error) {
    console.error("Error fetching memory:", error);
    return NextResponse.json(
      { error: "Failed to fetch memory" },
      { status: 500 }
    );
  }
}

// PUT - Update memory content manually
export async function PUT(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Get existing memory
    const [existingMemory] = await db
      .select()
      .from(memory)
      .orderBy(desc(memory.lastUpdatedAt))
      .limit(1);

    if (existingMemory) {
      const [updated] = await db
        .update(memory)
        .set({
          content,
          lastUpdatedAt: new Date().toISOString(),
        })
        .where(eq(memory.id, existingMemory.id))
        .returning();

      return NextResponse.json(updated);
    } else {
      const [newMemory] = await db
        .insert(memory)
        .values({ content })
        .returning();

      return NextResponse.json(newMemory, { status: 201 });
    }
  } catch (error) {
    console.error("Error updating memory:", error);
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 }
    );
  }
}
