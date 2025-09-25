import { NextResponse } from 'next/server';
import { db, notes } from '@/db';
import { and, eq, lte } from 'drizzle-orm';

export async function GET() {
  try {
    const nowIso = new Date().toISOString();

    const dueNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.status, 'active'), lte(notes.nextReviewAt, nowIso)))
      .orderBy(notes.nextReviewAt)
      .limit(1);

    return NextResponse.json({
      note: dueNotes[0] ?? null,
    });
  } catch (error) {
    console.error('Error fetching due note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch due note' },
      { status: 500 }
    );
  }
}
