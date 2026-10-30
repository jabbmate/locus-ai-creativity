import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { phaseSchema } from "@/lib/analysis-schemas";

const payloadSchema = z.object({ messages: z.array(z.object({ role: z.enum(["human", "ai"]), text: z.string().trim().min(1).max(2000) })).min(1).max(30), phase: phaseSchema });
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const phaseInstructions: Record<string, string> = {
  Baseline: "Ask one playful probing question. This is question-only support: do not supply new objects, solutions, examples, domains, analogies, or rules. Use only what the participant has already introduced. Ask for their own different idea.",
  "Creative cue": "Invite a vivid connection to an unrelated domain chosen by the participant. Do not name domains or give examples yourself.",
  "Co-creation": "Contribute at most one surprising but relevant conceptual seed, then invite the participant to expand, reject, lovingly sabotage, invert, or combine it.",
  Independent: "Ask for one new direction that is not already present. Do not contribute another concept and do not announce that you are stepping back.",
  Reflection: "Ask a lively gut-check about which idea is worth keeping, why, and when it began to feel like the participant's own.",
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return json({ error: "Live conversation is not configured." }, 503);
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid conversation payload." }, 400); }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid conversation payload." }, 400);
  const messages = parsed.data.messages.slice(-14);
  const phase = parsed.data.phase;
  const transcript = messages.map(message => `${message.role === "human" ? "Participant" : "Guide"}: ${message.text}`).join("\n");
  try {
  const { text } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-5.6"),
    maxOutputTokens: 120,
    maxRetries: 0,
    abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
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

  return json({ text });
  } catch {
    console.error("Locus guide unavailable (provider or timeout).");
    return json({ error: "The guide is unavailable. Please try again." }, 502);
  }
}
