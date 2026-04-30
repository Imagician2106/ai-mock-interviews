import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(request: Request) {
  const { conversationHistory, company, nextQuestion, isLastQuestion } =
    (await request.json()) as {
      conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
      company?: string;
      nextQuestion?: string;
      isLastQuestion?: boolean;
    };

  try {
    const companyContext =
      company && company !== "Other" && company !== ""
        ? `This interview is for a position at ${company}.`
        : "";

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: `You are a professional job interviewer conducting a real-time mock interview. ${companyContext}

Rules:
- Be professional yet warm and conversational
- Keep responses to 2-3 sentences maximum
- Briefly acknowledge the candidate's answer before asking the next question
- Ask ONE question at a time, never multiple
- If an answer is vague, ask one brief follow-up
- Do NOT repeat questions already asked in the conversation
- If isLastQuestion is true, thank the candidate warmly and say exactly: "This concludes our interview. Thank you for your time!"
- If nextQuestion is provided, ask that exact question after a brief acknowledgement
- Sound natural, like a real interviewer, not robotic`,
      messages: conversationHistory
        .filter((msg: { role: string; content: string }) => msg.content && msg.content.trim().length > 0)
        .map((msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }))
        .concat({
          role: "user",
          content: isLastQuestion
            ? "Please conclude the interview now."
            : `Please acknowledge my last answer briefly, then ask this next interview question exactly: ${nextQuestion}`,
        }),
    });

    return Response.json({ success: true, message: text }, { status: 200 });
  } catch (error: unknown) {
    console.error("Chat error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate response";
    const fallbackMessage = isLastQuestion
      ? "This concludes our interview. Thank you for your time!"
      : `Thank you for sharing that. ${nextQuestion || "Let's continue with the next question."}`;

    return Response.json(
      {
        success: true,
        message: fallbackMessage,
        error: message,
      },
      { status: 200 }
    );
  }
}
