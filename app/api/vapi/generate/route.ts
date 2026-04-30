import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { getAdminDb } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

function extractJsonArray(text: string): string[] {
  let cleaned = text.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const bracketMatch = cleaned.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    cleaned = bracketMatch[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  const lines = text
    .split("\n")
    .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter((line) => line.length > 10);

  if (lines.length > 0) return lines;

  return ["Tell me about yourself and your experience."];
}

function normalizeQuestionCount(questions: string[], amount: number, role: string, level: string, type: string) {
  const targetCount = Number.isFinite(amount) ? Math.max(1, Math.min(amount, 20)) : 10;
  const cleanedQuestions = questions
    .map((question) => String(question).trim())
    .filter((question) => question.length > 8);

  const fallbackQuestions = [
    `Tell me about yourself and your experience as a ${role}.`,
    `What recent project best represents your ${level} level skills?`,
    `Walk me through a challenging technical problem you solved.`,
    `How do you debug an issue when the root cause is unclear?`,
    `How do you communicate tradeoffs to a product or engineering team?`,
    `Describe a time you received feedback and changed your approach.`,
    `How would you prepare for a ${type} interview under time pressure?`,
    `What do you look for when reviewing code or design decisions?`,
    `How do you keep your technical knowledge current?`,
    `Why are you a strong fit for this role?`,
    `What question would you ask the interviewer about this role?`,
    `What is one area you are actively improving right now?`,
  ];

  const merged = [...cleanedQuestions, ...fallbackQuestions];
  return Array.from(new Set(merged)).slice(0, targetCount);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isQuotaError(error: unknown) {
  const message = getErrorMessage(error);
  const maybeData = error as { data?: { error?: { code?: number } } };

  return (
    message.includes("429") ||
    message.toLowerCase().includes("quota") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    maybeData.data?.error?.code === 429
  );
}

async function generateWithRetry(prompt: string, retries = 3): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const modelName of models) {
      try {
        const { text } = await generateText({
          model: google(modelName),
          prompt,
        });
        return text;
      } catch (error: unknown) {
        if (isQuotaError(error)) {
          console.log(`Quota exceeded for ${modelName}, trying next model...`);
          continue;
        }

        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    if (attempt < retries - 1) {
      const delay = Math.pow(2, attempt) * 2000;
      console.log(`All models failed on attempt ${attempt + 1}, waiting ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("All retry attempts exhausted");
}

export async function POST(request: Request) {
  const { type, role, level, techstack, amount, userid, company, languages, frameworks } =
    await request.json();
  const questionAmount = Number.parseInt(String(amount), 10) || 10;

  try {
    const companyContext =
      company && company !== "Other"
        ? `The interview is for a position at ${company}. Include questions that reflect ${company}'s interview style, culture, and the types of problems they are known to ask.`
        : "";

    const languageContext =
      languages && languages.length > 0
        ? `Focus questions on these programming languages: ${languages.join(", ")}.`
        : "";

    const frameworkContext =
      frameworks && frameworks.length > 0
        ? `Include questions about these frameworks and tools: ${frameworks.join(", ")}.`
        : "";

    const prompt = `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is exactly: ${questionAmount}.
        ${companyContext}
        ${languageContext}
        ${frameworkContext}
        Please return exactly ${questionAmount} questions and no fewer.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3", "..."]
        
        Thank you! <3
    `;

    const questionsText = await generateWithRetry(prompt);
    const questions = normalizeQuestionCount(
      extractJsonArray(questionsText),
      questionAmount,
      role,
      level,
      type
    );

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(","),
      questions: questions,
      amount: questionAmount,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      company: company || "",
      language: languages || [],
      framework: frameworks || [],
    };

    const db = getAdminDb();
    await db.collection("interviews").add(interview);

    return Response.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error:", error);

    return Response.json(
      {
        success: false,
        error: isQuotaError(error)
          ? "API quota exceeded. Please wait a moment and try again."
          : getErrorMessage(error) || "Failed to generate interview",
      },
      { status: isQuotaError(error) ? 429 : 500 }
    );
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
