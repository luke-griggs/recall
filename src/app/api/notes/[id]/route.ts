import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, notes } from "@/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const noteId = Number(resolvedParams.id);

    if (!Number.isInteger(noteId)) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const [deletedNote] = await db
      .delete(notes)
      .where(eq(notes.id, noteId))
      .returning({ id: notes.id });

    if (!deletedNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
