import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db, questions, notes } from '@/db';
import { eq } from 'drizzle-orm';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    // Get question and associated note
    const [question] = await db.select({
      questionText: questions.questionText,
      expectedAnswer: questions.expectedAnswer,
      noteContent: notes.content,
    })
    .from(questions)
    .leftJoin(notes, eq(questions.noteId, notes.id))
    .where(eq(questions.id, questionId));

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    const explanationPrompt = `You are helping a student who is struggling with a review question. Please provide a clear, helpful explanation that will help them understand the topic better.

Question: ${question.questionText}

Original note content: ${question.noteContent}
Expected answer criteria: ${question.expectedAnswer}

Please provide a concise but helpful explanation (2-3 sentences max) that:
1. Directly addresses the question
2. Helps the student understand the key concepts
3. Is encouraging and supportive
`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: explanationPrompt
      }]
    });

    const explanation = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({
      explanation,
      success: true
    });

  } catch (error) {
    console.error('Error generating explanation:', error);
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    );
  }
}