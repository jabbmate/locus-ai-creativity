import { requestSchema } from "@/lib/analysis-schemas";
import { analyzeTranscript } from "@/lib/analysis-pipeline";
import { createAnalysisProvider } from "@/lib/analysis-provider";

export const maxDuration = 300;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid transcript payload." }, 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Invalid transcript payload. Turn IDs must be unique and phases must follow protocol order." }, 400);
  if (!process.env.OPENAI_API_KEY) return json({ error: "Conversation analysis is not configured." }, 503);
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(265_000)]);
    return json(await analyzeTranscript(parsed.data.messages, createAnalysisProvider(), signal));
  } catch {
    // Provider errors can contain prompts and request bodies. Never log them.
    console.error("Locus analysis failed (provider, timeout, or output validation).");
    return json({ error: "The conversation could not be analyzed. Please retry." }, 502);
  }
}
