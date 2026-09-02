import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

type IncomingMessage = { role: "ai" | "human"; text: string; phase?: string };

const phaseInstructions: Record<string, string> = {
  Baseline: "Ask one playful probing question that helps the participant open a genuinely different direction. Do not contribute an idea or example yourself.",
  "Creative cue": "Invite one vivid, useful connection to a comically unrelated domain. The participant must supply the connection; do not supply it yourself.",
  "Co-creation": "Contribute at most one surprising but relevant conceptual seed, then invite the participant to expand, reject, lovingly sabotage, invert, or combine it.",
  Independent: "Ask for one new direction that is not already present. Do not contribute another concept and do not announce that you are stepping back.",
  Reflection: "Ask a lively gut-check about which idea is worth keeping, why, and when it began to feel like the participant's own.",
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
    system: `You are the concise guide for Locus, a short human-AI creativity experiment. Make the exchange entertaining, curious, lightly funny, and willing to get delightfully weird while staying anchored to the participant's actual idea. Use vivid constraints, playful counterfactuals, unexpected analogies, and occasional gentle absurdity; do not become random, cutesy, or perform a stand-up routine. Ask one clear question at a time and keep every reply under 65 words.

Never name or reveal the current phase, protocol, experimental condition, or analysis goal. Never say baseline, creativity cue, co-creation, independent stage, reflection stage, “now we collaborate,” “I will stop contributing,” or anything equivalent. Transition naturally. Do not praise, score, diagnose, explain metrics, or tell the participant how creative they are. Respond specifically to what they just said rather than using a generic creativity exercise.

Hidden guide instruction: ${phaseInstructions[phase] ?? phaseInstructions.Baseline}`,
    prompt: `Continue this transcript with only the guide's next reply.\n\n${transcript}`,
  });

  return Response.json({ text });
}
