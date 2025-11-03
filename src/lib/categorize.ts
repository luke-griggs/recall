import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const CATEGORIES = [
  "Large language models",
  "Machine learning",
  "Software engineering",
  "Databases and data systems",
  "Operating systems",
  "Linear algebra",
  "Quantum computing",
  "Neuroscience",
  "Particle physics",
  "Aerospace engineering",
  "Electrical engineering",
  "Robotics",
  "Biology",
  "Music",
  "French",
  "History",
  "Economics",
  "Finance",
  "Bitcoin",
  "Miscellaneous",
] as const;

export type NoteCategory = (typeof CATEGORIES)[number];

export async function categorizeNote(content: string): Promise<NoteCategory> {
  try {
    const fullText = `Content: ${content}`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a categorization assistant. Given a note, categorize it into ONE of the following categories:

${CATEGORIES.map((cat, idx) => `${idx + 1}. ${cat}`).join("\n")}

Respond with ONLY the category name, nothing else. Choose the most specific and appropriate category. If the note doesn't clearly fit into any specific category, use "Miscellaneous".`,
        },
        {
          role: "user",
          content: fullText,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 50,
    });

    const category = completion.choices[0]?.message?.content?.trim() || "";

    // Validate that the returned category is one of our valid categories
    if (CATEGORIES.includes(category as NoteCategory)) {
      return category as NoteCategory;
    }

    // If the model returns something unexpected, default to Miscellaneous
    console.warn(
      `Unexpected category returned: "${category}". Defaulting to Miscellaneous.`
    );
    return "Miscellaneous";
  } catch (error) {
    console.error("Error categorizing note:", error);
    // Default to Miscellaneous if categorization fails
    return "Miscellaneous";
  }
}
