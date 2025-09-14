import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db, notes, questions } from '@/db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const QUESTION_GENERATION_PROMPT = `
You are going to be provided with an observation or explanation of something I recently learned about. Your job is to construct a question that will be used to review the topic as well as criteria for a sufficient answer.

There are two different kinds of observations/explanations you will receive:

**For surface-level facts or simple claims** (e.g., "The distance from Earth to Moon is 384,400 km"):
- Generate straightforward recall questions
- Focus on remembering the key fact or figure

**For deeper insights or detailed explanations** (e.g., mathematical theorems, scientific processes, complex relationships):
- Generate questions that test understanding, not just memorization
- Focus on concepts, relationships, or applications
- May ask "why," "how," or "what happens if"

For the expectedAnswer field, provide concise set of criteria that define a sufficient response:
- Key facts, numbers, or terms that should be mentioned
- Acceptable alternative phrasings or equivalent answers  
- Essential concepts that demonstrate understanding

Examples:
- For factual: "Must mention 384,400 and km (or equivalent in miles: 238,855)"
- For conceptual: "Must explain the relationship between X and Y, and mention that Z occurs when..."

Please respond with a JSON object in the following format:
{
  "question": "The generated question text here",
  "questionType": "recall|conceptual|application", 
  "expectedAnswer": "Specific criteria for what constitutes a sufficient answer"
}

Only return the JSON object, no additional text.
`;

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

    // Insert the note into the database
    const [newNote] = await db.insert(notes).values({
      content,
      explanation,
      tags,
      difficultyEstimate,
    }).returning();

    // Generate question using Anthropic API
    const noteForQuestion = explanation || content;
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${QUESTION_GENERATION_PROMPT}\n\nNote content:\n${noteForQuestion}`
      }]
    });

    let questionData;
    try {
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      questionData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Anthropic response:', parseError);
      return NextResponse.json(
        { error: 'Failed to generate question' },
        { status: 500 }
      );
    }

    // Insert the generated question into the database
    const [newQuestion] = await db.insert(questions).values({
      noteId: newNote.id,
      questionText: questionData.question,
      expectedAnswer: questionData.expectedAnswer,
      questionType: 'recall',
      generatedByModel: 'claude-sonnet-4-20250514',
      generationPrompt: QUESTION_GENERATION_PROMPT,
    }).returning();

    return NextResponse.json({
      note: newNote,
      question: newQuestion,
      success: true
    });

  } catch (error) {
    console.error('Error creating note and question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}