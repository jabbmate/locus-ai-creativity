import { z } from "zod";

export const phaseSchema = z.enum(["Baseline", "Creative cue", "Co-creation", "Independent", "Reflection"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export const operationSchema = z.enum(["idea_generation", "branching", "challenge", "synthesis", "reframing", "evaluation", "amplification", "possible_ai_preemption", "analogy", "independent_divergence"]);
export const messageSchema = z.object({
  id: z.number().int().positive(), role: z.enum(["human", "ai"]), text: z.string().trim().min(1).max(2000),
  phase: phaseSchema, responseMs: z.number().int().min(0).max(3_600_000).nullish(),
});
export const requestSchema = z.object({ messages: z.array(messageSchema).min(2).max(30) }).superRefine(({ messages }, ctx) => {
  if (new Set(messages.map(m => m.id)).size !== messages.length) ctx.addIssue({ code: "custom", message: "Turn IDs must be unique." });
  const phases = phaseSchema.options;
  if (messages.some((m, i) => i > 0 && phases.indexOf(m.phase) < phases.indexOf(messages[i - 1].phase))) ctx.addIssue({ code: "custom", message: "Protocol phases cannot go backward." });
});

// One output per turn prevents early material from exhausting a session-wide cap.
export const extractionSchema = (limit: number) => z.object({
  substantive: z.boolean(), complete: z.boolean(), reason: z.string().min(1).max(240),
  ideas: z.array(z.object({ label: z.string().min(1).max(60), summary: z.string().min(1).max(260), quote: z.string().min(1).max(1000) })).max(limit),
  operations: z.array(operationSchema).max(10), summary: z.string().min(1).max(260), confidence: confidenceSchema,
});
export type TurnExtraction = z.infer<ReturnType<typeof extractionSchema>>;
export const relationSchema = z.object({
  ideaId: z.string(), turnId: z.number().int().positive(), phase: phaseSchema,
  parentIds: z.array(z.string()).max(12),
  origin: z.enum(["human", "ai", "co-created", "uncertain"]),
  relation: z.enum(["new", "develops", "combines", "rejects", "repeats", "uncertain"]),
  isBranch: z.boolean(), evidenceTurnIds: z.array(z.number().int().positive()).max(30),
});
export type IdeaRelation = z.infer<typeof relationSchema>;
const judgmentSchema = z.object({
  score: z.number().min(0).max(1), rationale: z.string().min(1).max(400),
  confidence: confidenceSchema, uncertainty: z.string().min(1).max(300),
  evidenceTurnIds: z.array(z.number().int().positive()).max(30),
});
const countSchema = judgmentSchema.omit({ score: true }).extend({ count: z.number().int().min(0).max(360) });
export const reviewSchema = z.object({
  relations: z.array(relationSchema).max(720),
  judgments: z.object({ aiAmplification: judgmentSchema, evaluativeDepth: judgmentSchema, possibleAiPreemption: countSchema, coCreativeEmergence: countSchema }),
});
export type Review = z.infer<typeof reviewSchema>;
