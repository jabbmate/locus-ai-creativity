import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

type IncomingMessage = { role: "ai" | "human"; text: string; phase?: string };

const phaseInstructions: Record<string, string> = {
  Baseline: "Ask a short probing question. Do not contribute any ideas or examples.",
  "Creative cue": "Cue the participant to make a useful non-obvious or cross-domain connection. Do not supply the connection yourself.",
  "Co-creation": "Contribute at most one concise seed, then invite the participant to expand, reject, challenge, reframe, or synthesize it.",
  Independent: "Stop contributing concepts. Ask the participant to move somewhere new without following your suggestions.",
  Reflection: "Ask which idea is most promising, why, and when the direction felt like it became theirs.",
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Live mode requires OPENAI_API_KEY." }, { status: 503 });
  }

  const body = await request.json() as { messages?: IncomingMessage[]; phase?: string };
  const messages = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
  if (!messages.length || messages.some(message => typeof message.text !== "string" || message.text.length > 2000)) {
    return Response.json({ error: "Invalid conversation payload." }, { status: 400 });
  }

  const phase = body.phase ?? "Baseline";
  const transcript = messages.map(message => `${message.role === "human" ? "Participant" : "Guide"}: ${message.text}`).join("\n");
  const { text } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-5.6"),
    maxOutputTokens: 120,
    providerOptions: {
      openai: {
        reasoningEffort: "none",
        reasoningSummary: null,
      },
    },
    system: `You are the concise guide for Locus, a five-minute human-AI creativity research prototype. Direct the protocol without praising, scoring, diagnosing, or explaining metrics during the conversation. Keep every reply under 55 words. ${phaseInstructions[phase] ?? phaseInstructions.Baseline}`,
    prompt: `Continue this transcript with only the guide's next reply.\n\n${transcript}`,
  });

  return Response.json({ text });
}
