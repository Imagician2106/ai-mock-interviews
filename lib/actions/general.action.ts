"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { getAdminDb } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

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

async function generateFeedbackObject(prompt: string) {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];

  for (const modelName of models) {
    try {
      const { object } = await generateObject({
        model: google(modelName, {
          structuredOutputs: false,
        }),
        schema: feedbackSchema,
        prompt,
        system:
          "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
      });

      return object;
    } catch (error) {
      if (!isQuotaError(error) || modelName === models[models.length - 1]) {
        throw error;
      }

      console.log(`Quota exceeded for ${modelName}, trying next feedback model...`);
    }
  }

  throw new Error("Feedback generation failed");
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analyzeTranscript(transcript: CreateFeedbackParams["transcript"]) {
  const userMessages = transcript.filter((message) => message.role === "user");
  const assistantMessages = transcript.filter((message) => message.role === "assistant");
  const answerStats = userMessages.map((message) => {
    const normalized = message.content.toLowerCase().trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    const isVague =
      words.length < 8 ||
      /\b(i don't know|dont know|no idea|not sure|skip|pass|idk|nothing|maybe|project\.?)\b/.test(normalized);

    return {
      wordCount: words.length,
      isVague,
      isSubstantial: words.length >= 25 && !isVague,
    };
  });

  const wordCount = answerStats.reduce((total, answer) => total + answer.wordCount, 0);
  const completedTurns = Math.min(userMessages.length, assistantMessages.length || userMessages.length);
  const averageWords = userMessages.length > 0 ? wordCount / userMessages.length : 0;
  const vagueAnswers = answerStats.filter((answer) => answer.isVague).length;
  const substantialAnswers = answerStats.filter((answer) => answer.isSubstantial).length;
  const vagueRatio = userMessages.length > 0 ? vagueAnswers / userMessages.length : 1;

  let scoreCap = 78;
  if (userMessages.length === 0) scoreCap = 15;
  else if (userMessages.length < 2) scoreCap = 35;
  else if (averageWords < 5) scoreCap = 28;
  else if (averageWords < 12) scoreCap = 42;
  else if (vagueRatio >= 0.5) scoreCap = 48;
  else if (completedTurns < 3) scoreCap = 55;
  else if (substantialAnswers >= 4 && averageWords >= 35) scoreCap = 88;

  const evidenceScore = clampScore(
    18 +
      completedTurns * 4 +
      Math.min(averageWords, 45) * 1.05 +
      substantialAnswers * 5 -
      vagueRatio * 24
  );
  const transcriptScore = Math.min(evidenceScore, scoreCap);

  return {
    userMessages,
    completedTurns,
    wordCount,
    averageWords,
    vagueAnswers,
    substantialAnswers,
    scoreCap,
    transcriptScore,
  };
}

function applyTranscriptCaps<T extends {
  totalScore: number;
  categoryScores: Feedback["categoryScores"];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
}>(evaluation: T, transcript: CreateFeedbackParams["transcript"]): T {
  const analysis = analyzeTranscript(transcript);
  const cappedTotal = clampScore(Math.min(evaluation.totalScore, analysis.scoreCap));
  const categoryScores = evaluation.categoryScores.map((category) => ({
    ...category,
    score: clampScore(Math.min(category.score, analysis.scoreCap)),
  }));

  return {
    ...evaluation,
    totalScore: cappedTotal,
    categoryScores,
    areasForImprovement: [
      ...evaluation.areasForImprovement,
      ...(analysis.vagueAnswers > 0
        ? ["Avoid very short or vague answers; include a concrete example, reasoning, and outcome."]
        : []),
    ].slice(0, 5),
    finalAssessment:
      cappedTotal < evaluation.totalScore
        ? `${evaluation.finalAssessment} Score was capped because the saved transcript did not contain enough complete, specific candidate evidence for a higher rating.`
        : evaluation.finalAssessment,
  };
}

function buildFallbackFeedback(transcript: CreateFeedbackParams["transcript"]) {
  const analysis = analyzeTranscript(transcript);
  const baseScore = analysis.transcriptScore;
  const shortAnswerNote =
    analysis.averageWords < 12
      ? " Most answers were short, so this area is scored conservatively."
      : "";

  return {
    totalScore: baseScore,
    categoryScores: [
      {
        name: "Communication Skills",
        score: clampScore(baseScore + (analysis.averageWords >= 20 ? 4 : 0)),
        comment:
          analysis.userMessages.length > 0
            ? `Communication was evaluated from ${analysis.userMessages.length} captured answer(s).${shortAnswerNote}`
            : "No spoken or typed answer was captured, so communication could not be fully assessed.",
      },
      {
        name: "Technical Knowledge",
        score: clampScore(baseScore - 8),
        comment:
          "Technical score is low unless the transcript includes specific concepts, tradeoffs, tools, or implementation details.",
      },
      {
        name: "Problem Solving",
        score: clampScore(baseScore - 6),
        comment:
          "Problem solving needs clear reasoning, alternatives, and outcomes; short answers are not enough for a high score.",
      },
      {
        name: "Cultural Fit",
        score: clampScore(baseScore),
        comment:
          "Role fit was estimated only from engagement and the completeness of the captured answers.",
      },
      {
        name: "Confidence and Clarity",
        score: clampScore(baseScore - (analysis.vagueAnswers > 0 ? 5 : 0)),
        comment:
          "Confidence and clarity are reduced when answers are vague, incomplete, or too brief.",
      },
    ],
    strengths:
      analysis.substantialAnswers > 0
        ? [
            "At least one answer included enough detail to evaluate.",
            "The transcript was saved for review and improvement.",
          ]
        : ["The interview transcript was saved for review."],
    areasForImprovement: [
      "Give complete examples with context, action, reasoning, and result.",
      "Add role-specific technical details instead of one-line answers.",
      "Answer follow-up questions directly before moving on.",
    ],
    finalAssessment:
      `Fallback feedback was generated from the saved transcript because the AI scoring service could not complete the full evaluation. The score is intentionally conservative and capped at ${analysis.scoreCap}/100 based on answer depth and completeness.`,
  };
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;
  const db = getAdminDb();

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const object = await generateFeedbackObject(`
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        Scoring must be strict:
        - 90-100 only for exceptional, complete, specific answers with strong evidence across most questions.
        - 70-89 for solid answers with some depth and examples.
        - 45-69 for partial, generic, or inconsistent answers.
        - 0-44 for very short, vague, skipped, incorrect, or mostly missing answers.
        - If the candidate says they do not know, skips, gives one-word answers, or only gives fragments, score that category low.
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `);
    const scoredObject = applyTranscriptCaps(object, transcript);

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: scoredObject.totalScore,
      categoryScores: scoredObject.categoryScores,
      strengths: scoredObject.strengths,
      areasForImprovement: scoredObject.areasForImprovement,
      finalAssessment: scoredObject.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error generating feedback, saving fallback feedback:", error);

    try {
      const fallbackObject = buildFallbackFeedback(transcript);
      const fallbackFeedback = {
        interviewId,
        userId,
        totalScore: fallbackObject.totalScore,
        categoryScores: fallbackObject.categoryScores,
        strengths: fallbackObject.strengths,
        areasForImprovement: fallbackObject.areasForImprovement,
        finalAssessment: fallbackObject.finalAssessment,
        createdAt: new Date().toISOString(),
      };

      const feedbackRef = feedbackId
        ? db.collection("feedback").doc(feedbackId)
        : db.collection("feedback").doc();

      await feedbackRef.set(fallbackFeedback);

      return { success: true, feedbackId: feedbackRef.id, fallback: true };
    } catch (fallbackError) {
      console.error("Error saving fallback feedback:", fallbackError);
      return { success: false };
    }
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const db = getAdminDb();
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;
  const db = getAdminDb();

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;
  const db = getAdminDb();

  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  const db = getAdminDb();
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}
