import { NextRequest, NextResponse } from 'next/server';
import { db, questions } from '@/db';
import { lte, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const now = new Date().toISOString();
    
    // Fetch questions that are due for review (nextReviewDate <= now) and are active
    const dueQuestions = await db.select().from(questions)
      .where(
        lte(questions.nextReviewDate, now)
      )
      .orderBy(questions.nextReviewDate)
      .limit(1); // Get one question at a time for now

    return NextResponse.json({
      question: dueQuestions[0] || null,
      hasMore: dueQuestions.length > 0
    });

  } catch (error) {
    console.error('Error fetching due questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch due questions' },
      { status: 500 }
    );
  }
}