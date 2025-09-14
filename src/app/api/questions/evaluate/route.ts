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
    const { questionId, userAnswer } = body;

    if (!questionId || !userAnswer) {
      return NextResponse.json(
        { error: 'Question ID and user answer are required' },
        { status: 400 }
      );
    }

    // Get question and associated note
    const [question] = await db.select({
      questionText: questions.questionText,
      expectedAnswer: questions.expectedAnswer,
      noteContent: notes.content,
      noteExplanation: notes.explanation,
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

    const evaluationPrompt = `You are evaluating a student's answer to a review question. Please determine if their answer is correct and provide helpful feedback.

Question: ${question.questionText}

Expected answer criteria: ${question.expectedAnswer}

Student's answer: ${userAnswer}

Original note content: ${question.noteContent}
${question.noteExplanation ? `Additional context: ${question.noteExplanation}` : ''}

Please respond with a JSON object in this format:
{
  "isCorrect": true/false,
  "feedback": "Brief explanation of why the answer was correct/incorrect and what could be improved",
  "suggestedQuality": 0-5
}

For isCorrect:
- true if the student's answer meets the essential criteria from the expected answer
- false if it's missing key information or is incorrect

For feedback:
- If correct: Brief positive feedback highlighting what they got right
- If incorrect: Gentle explanation of what was missing or wrong, and what the correct answer should include

For suggestedQuality (0-5 scale):
- 0-1: Completely wrong or no meaningful content
- 2: Has some relevant information but major gaps
- 3: Meets basic criteria but could be more complete
- 4: Good answer with minor gaps
- 5: Excellent, complete answer

Keep feedback concise (1-2 sentences) and encouraging.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: evaluationPrompt
      }]
    });

    let evaluationData;
    try {
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      evaluationData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse evaluation response:', parseError);
      return NextResponse.json(
        { error: 'Failed to evaluate answer' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...evaluationData,
      success: true
    });

  } catch (error) {
    console.error('Error evaluating answer:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer' },
      { status: 500 }
    );
  }
}