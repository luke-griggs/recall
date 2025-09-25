import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { db, notes, reviews } from '@/db';
import { eq } from 'drizzle-orm';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
const MODEL_NAME = 'meta-llama/llama-4-scout-17b-16e-instruct';

const QUESTION_PROMPT_TEMPLATE = (noteContent: string) => `You are a kind professor who is an expert in their field. A few days ago you were working with a student in class and they drew the following conclusion: ${noteContent}

It's a few days later and we'd like to check if they still remember the conclusion they drew. Can you provide a question that their conclusion might've been the answer to?

The ultimate goal is to see if the user can explain the underlying concept in their conclusion

Please return the question only with no other text`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { noteId } = body;

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    const [note] = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const prompt = QUESTION_PROMPT_TEMPLATE(
      note.explanation ? `${note.content}\n\nAdditional context: ${note.explanation}` : note.content
    );

    const completion = await groq.chat.completions.create({
      model: MODEL_NAME,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const questionText = completion.choices[0]?.message?.content?.trim();

    if (!questionText) {
      return NextResponse.json(
        { error: 'Failed to generate question' },
        { status: 500 }
      );
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        noteId,
        questionText,
        modelName: MODEL_NAME,
        generationPrompt: prompt,
      })
      .returning({ id: reviews.id, questionText: reviews.questionText });

    return NextResponse.json({
      reviewId: newReview.id,
      question: newReview.questionText,
    });
  } catch (error) {
    console.error('Error starting review session:', error);
    return NextResponse.json(
      { error: 'Failed to start review session' },
      { status: 500 }
    );
  }
}
