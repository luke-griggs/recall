import { NextRequest, NextResponse } from 'next/server';
import { db, notes } from '@/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, explanation, tags, difficultyEstimate } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const [newNote] = await db
      .insert(notes)
      .values({
        content,
        explanation,
        tags,
        difficultyEstimate,
      })
      .returning();

    return NextResponse.json({
      note: newNote,
      success: true,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
