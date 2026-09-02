import { cosineSimilarity, embedMany, generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { AnalysisResult, AtomicIdea, Confidence, Metric, MetricGroup, Phase, SessionMessage } from "@/lib/analysis";

export const maxDuration = 300;

const phaseSchema = z.enum(["Baseline", "Creative cue", "Co-creation", "Independent", "Reflection"]);
const confidenceSchema = z.enum(["high", "medium", "low"]);
const operationSchema = z.enum([
  "idea_generation",
  "branching",
  "challenge",
  "synthesis",
  "reframing",
  "evaluation",
  "amplification",
  "possible_ai_preemption",
  "analogy",
  "independent_divergence",
]);

const evidenceJudgmentSchema = z.object({
  score: z.number().min(0).max(1),
  rationale: z.string().min(1).max(280),
  confidence: confidenceSchema,
  uncertainty: z.string().min(1).max(220),
  evidenceTurnIds: z.array(z.number().int().positive()).max(8),
});

const countJudgmentSchema = z.object({
  count: z.number().int().min(0).max(30),
  rationale: z.string().min(1).max(280),
  confidence: confidenceSchema,
  uncertainty: z.string().min(1).max(220),
  evidenceTurnIds: z.array(z.number().int().positive()).max(8),
});

const analysisDraftSchema = z.object({
  personalReport: z.object({
    headline: z.string().min(1).max(90),
    headlineEmphasis: z.string().min(1).max(45),
    summary: z.string().min(1).max(420),
    aiEffectVerdict: z.enum(["boosted", "mixed", "no_clear_change", "constrained", "inconclusive"]),
    aiEffectConfidence: confidenceSchema,
    aiEffectHeadline: z.string().min(1).max(100),
    aiEffectExplanation: z.string().min(1).max(420),
    aiEffectSignals: z.array(z.object({
      title: z.string().min(1).max(75),
      direction: z.enum(["boost", "drag", "neutral"]),
      explanation: z.string().min(1).max(260),
      evidenceTurnIds: z.array(z.number().int().positive()).min(1).max(5),
    })).length(3),
    phaseTakeaways: z.array(z.object({
      label: z.string().min(1).max(40),
      explanation: z.string().min(1).max(240),
    })).length(3),
    takeaways: z.array(z.object({
      title: z.string().min(1).max(95),
      explanation: z.string().min(1).max(300),
      evidenceTurnIds: z.array(z.number().int().positive()).min(1).max(5),
    })).length(3),
    coachingPlan: z.array(z.object({
      title: z.string().min(1).max(80),
      action: z.string().min(1).max(260),
      whyThisFits: z.string().min(1).max(260),
      tryPrompt: z.string().min(1).max(320),
      evidenceTurnIds: z.array(z.number().int().positive()).min(1).max(5),
    })).length(3),
    bottomLine: z.string().min(1).max(360),
    bottomLineCaveat: z.string().min(1).max(240),
  }),
  atomicIdeas: z.array(z.object({
    id: z.string().regex(/^idea_[0-9]+$/),
    label: z.string().min(1).max(42),
    summary: z.string().min(1).max(220),
    source: z.enum(["human", "ai", "co-created"]),
    phase: phaseSchema,
    turnId: z.number().int().positive(),
    parentIds: z.array(z.string().regex(/^idea_[0-9]+$/)).max(6),
    isBranch: z.boolean(),
    confidence: confidenceSchema,
  })).min(1).max(30),
  transcriptAnnotations: z.array(z.object({
    turnId: z.number().int().positive(),
    summary: z.string().min(1).max(240),
    operations: z.array(operationSchema).max(6),
    atomicIdeaIds: z.array(z.string().regex(/^idea_[0-9]+$/)).max(8),
    confidence: confidenceSchema,
  })).min(1).max(30),
  judgments: z.object({
    aiAmplification: evidenceJudgmentSchema,
    evaluativeDepth: evidenceJudgmentSchema,
    possibleAiPreemption: countJudgmentSchema,
    coCreativeEmergence: countJudgmentSchema,
  }),
});

const incomingMessageSchema = z.object({
  id: z.number().int().positive(),
  role: z.enum(["ai", "human"]),
  text: z.string().min(1).max(2000),
  phase: phaseSchema,
  responseMs: z.number().int().min(0).max(3_600_000).nullable(),
});

const requestSchema = z.object({ messages: z.array(incomingMessageSchema).min(2).max(30) });

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};
const distance = (a: number[], b: number[]) => clamp(1 - cosineSimilarity(a, b));
const validEvidence = (ids: number[], turnIds: Set<number>) => [...new Set(ids.filter(id => turnIds.has(id)))];
const confidenceForSample = (size: number): Confidence => size >= 5 ? "high" : size >= 2 ? "medium" : "low";

function lexicalDiversity(messages: SessionMessage[]) {
  const words = messages.filter(message => message.role === "human").flatMap(message => message.text.toLowerCase().match(/[a-z0-9']+/g) ?? []);
  return words.length ? new Set(words).size / words.length : null;
}

function firstPrincipalProjection(embeddings: number[][]) {
  if (embeddings.length < 2) return embeddings.map(() => 0.5);
  const dimensions = embeddings[0].length;
  const center = Array.from({ length: dimensions }, (_, dimension) => embeddings.reduce((sum, row) => sum + row[dimension], 0) / embeddings.length);
  const rows = embeddings.map(row => row.map((value, dimension) => value - center[dimension]));
  let vector = Array.from({ length: dimensions }, (_, index) => ((index % 17) + 1) / 17);
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const next = Array(dimensions).fill(0) as number[];
    for (const row of rows) {
      const dot = row.reduce((sum, value, dimension) => sum + value * vector[dimension], 0);
      row.forEach((value, dimension) => { next[dimension] += value * dot; });
    }
    const norm = Math.sqrt(next.reduce((sum, value) => sum + value * value, 0)) || 1;
    vector = next.map(value => value / norm);
  }
  const projected = rows.map(row => row.reduce((sum, value, dimension) => sum + value * vector[dimension], 0));
  const minimum = Math.min(...projected);
  const maximum = Math.max(...projected);
  return maximum === minimum ? projected.map(() => 0.5) : projected.map(value => (value - minimum) / (maximum - minimum));
}

function metric(input: Metric): Metric { return input; }

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Conversation analysis requires OPENAI_API_KEY." }, { status: 503 });
  }

  try {
    const raw = await request.json() as { messages?: Array<Omit<SessionMessage, "responseMs"> & { responseMs?: number }> };
    const parsed = requestSchema.safeParse({
      messages: Array.isArray(raw.messages) ? raw.messages.map(message => ({ ...message, responseMs: message.responseMs ?? null })) : raw.messages,
    });
    if (!parsed.success) return Response.json({ error: "Invalid transcript payload." }, { status: 400 });

    const messages = parsed.data.messages as SessionMessage[];
    const turnIds = new Set(messages.map(message => message.id));
    const modelId = process.env.OPENAI_ANALYSIS_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6";
    const embeddingModelId = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    const transcript = messages.map(message => {
      const timing = message.responseMs == null ? "timing unavailable" : `response ${message.responseMs}ms`;
      return `Turn ${message.id} | ${message.phase} | ${message.role === "human" ? "Participant" : "AI guide"} | ${timing}\n${message.text}`;
    }).join("\n\n");

    const { output: draft } = await generateText({
      model: openai(modelId),
      output: Output.object({ schema: analysisDraftSchema }),
      maxOutputTokens: 12_000,
      providerOptions: {
        openai: {
          reasoningEffort: "none",
          reasoningSummary: null,
        },
      },
      system: `You are the evidence-constrained analysis engine for Locus, an exploratory human-AI creativity research prototype. Analyze only the supplied transcript. Never infer stable intelligence, personality, clinical state, neurological mechanism, or literal brain function. Do not praise the participant. Distinguish observed text, model judgment, and uncertainty. Every claim must cite valid transcript turn IDs in its evidenceTurnIds field; do not put turn numbers or citation markers inside personal-report prose. Extract atomic ideas at the smallest conceptually meaningful level; include substantive concepts introduced by both the participant and AI, but do not count a question as an idea unless it contributes a conceptual seed. Parent IDs must refer only to earlier atomic ideas. Mark a branch only when an idea opens a materially different direction. Operations must use only the allowed taxonomy. Possible AI preemption requires evidence that an AI suggestion may have displaced or narrowed an emerging human direction; use zero when evidence is absent. Co-creative emergence requires a result not reasonably attributable to either side alone.

Write the personal report for an everyday participant, not a scientist. The headline and headlineEmphasis are rendered next to each other: write headline as the opening clause and headlineEmphasis as a short final phrase that completes it grammatically without repeating any words or ideas. Keep every prose field within its limit using complete sentences; never trail off, duplicate a phrase, or end on a fragment. Give a direct but cautious within-session verdict: boosted when there is converging evidence that AI opened or strengthened human creative movement; constrained when it narrowed, displaced, or stalled it; mixed when both happened; no_clear_change when the observed contrasts are small or contradictory; and inconclusive when the transcript lacks a usable before/during/after comparison. This verdict is a session-level interpretation, never a causal or stable-person claim. Set confidence according to the clarity and quantity of transcript evidence and do not use high confidence for a single short session.

The three aiEffectSignals must make the verdict inspectable: identify concrete evidence for expansion, constraint, or no clear change and cite the relevant turns. The three phase takeaways must cover before AI input, working with AI, and after AI steps back, using natural labels rather than research jargon. The three coachingPlan items must be highly specific to this participant's behavior. Each must say exactly what to do with AI next time, why that advice fits this transcript, and include a ready-to-copy prompt. Avoid generic advice such as “think outside the box,” “be more creative,” or “ask follow-up questions.” Favor practical techniques such as generating independently before asking AI, requesting contrasting mechanisms rather than finished answers, forcing the AI to critique or invert a human idea, or making the human synthesize after AI input—but only when the transcript supports that recommendation. Use plain, concrete language throughout.`,
      prompt: `Analyze this complete Locus transcript. Re-scan it before finalizing so every substantive idea and evidence link is captured. Return only the schema-defined analysis.\n\n${transcript}`,
    });

    const seenIdeaIds = new Set<string>();
    const validDraftIdeas = draft.atomicIdeas.filter(idea => {
      if (!turnIds.has(idea.turnId) || seenIdeaIds.has(idea.id)) return false;
      seenIdeaIds.add(idea.id);
      return true;
    });
    const ideaOrder = new Map(validDraftIdeas.map((idea, index) => [idea.id, index]));
    const atomicIdeas: AtomicIdea[] = validDraftIdeas.map((idea, index) => ({
      ...idea,
      parentIds: idea.parentIds.filter(parentId => (ideaOrder.get(parentId) ?? index) < index),
    }));
    if (!atomicIdeas.length) throw new Error("No atomic ideas were extracted.");
    const ideaIds = new Set(atomicIdeas.map(idea => idea.id));

    const { embeddings } = await embedMany({
      model: openai.embedding(embeddingModelId),
      values: atomicIdeas.map(idea => `${idea.label}: ${idea.summary}`),
    });
    if (embeddings.length !== atomicIdeas.length) throw new Error("Embedding count did not match extracted ideas.");

    const annotations = draft.transcriptAnnotations
      .filter(annotation => turnIds.has(annotation.turnId))
      .map(annotation => ({
        ...annotation,
        atomicIdeaIds: annotation.atomicIdeaIds.filter(ideaId => ideaIds.has(ideaId)),
      }));
    const operationTurns = (operation: string) => annotations.filter(annotation => annotation.operations.includes(operation as never)).map(annotation => annotation.turnId);
    const humanMessages = messages.filter(message => message.role === "human");
    const humanIdeas = atomicIdeas.filter(idea => idea.source === "human");
    const aiIdeas = atomicIdeas.filter(idea => idea.source === "ai");
    const rootIdeas = atomicIdeas.filter(idea => idea.parentIds.length === 0);
    const humanRootIdeas = rootIdeas.filter(idea => idea.source === "human");
    const humanBranches = atomicIdeas.filter(idea => idea.source === "human" && idea.isBranch);
    const aiBranches = atomicIdeas.filter(idea => idea.source === "ai" && idea.isBranch);
    const humanIdeaIndexes = atomicIdeas.flatMap((idea, index) => idea.source === "human" ? [index] : []);
    const aiIdeaIndexes = atomicIdeas.flatMap((idea, index) => idea.source === "ai" ? [index] : []);
    const consecutiveDistances = embeddings.slice(1).map((embedding, index) => distance(embeddings[index], embedding));
    const pairwiseHumanDistances = humanIdeaIndexes.flatMap((left, position) => humanIdeaIndexes.slice(position + 1).map(right => distance(embeddings[left], embeddings[right])));
    const meanSemanticDistance = mean(consecutiveDistances);
    const conceptualDiversity = mean(pairwiseHumanDistances);

    const aiPullDistances = atomicIdeas.flatMap((idea, index) => {
      if (idea.source !== "human") return [];
      const aiParentIndexes = idea.parentIds.flatMap(parentId => {
        const parentIndex = atomicIdeas.findIndex(candidate => candidate.id === parentId && candidate.source === "ai");
        return parentIndex >= 0 ? [parentIndex] : [];
      });
      return aiParentIndexes.map(parentIndex => distance(embeddings[index], embeddings[parentIndex]));
    });
    const aiCreativePull = aiPullDistances.length ? 1 - (mean(aiPullDistances) ?? 0) : null;

    const aiCentroid = aiIdeaIndexes.length ? Array.from({ length: embeddings[0].length }, (_, dimension) => aiIdeaIndexes.reduce((sum, index) => sum + embeddings[index][dimension], 0) / aiIdeaIndexes.length) : null;
    const distanceFromAi = (phase: Phase) => aiCentroid ? mean(atomicIdeas.flatMap((idea, index) => idea.source === "human" && idea.phase === phase ? [distance(embeddings[index], aiCentroid)] : [])) : null;
    const coCreationDistance = distanceFromAi("Co-creation");
    const independentDistance = distanceFromAi("Independent");
    const divergenceRecovery = coCreationDistance != null && independentDistance != null ? independentDistance - coCreationDistance : null;

    const noveltyByIndex = embeddings.map((embedding, index) => index === 0 ? null : Math.min(...embeddings.slice(0, index).map(previous => distance(embedding, previous))));
    const phaseNovelty = (phase: Phase) => mean(atomicIdeas.flatMap((idea, index) => idea.source === "human" && idea.phase === phase && noveltyByIndex[index] != null ? [noveltyByIndex[index] as number] : []));
    const baselineNovelty = phaseNovelty("Baseline");
    const cuedNovelty = phaseNovelty("Creative cue");
    const postAiNovelty = phaseNovelty("Independent");
    const responseTimes = humanMessages.flatMap(message => message.responseMs == null ? [] : [message.responseMs]);
    const medianResponseMs = median(responseTimes);
    const lexical = lexicalDiversity(messages);
    const challengeTurns = operationTurns("challenge");
    const synthesisTurns = operationTurns("synthesis");
    const reframingTurns = operationTurns("reframing");
    const humanInitiation = rootIdeas.length ? humanRootIdeas.length / rootIdeas.length : null;

    const phaseEvidence = (phase: Phase) => atomicIdeas.filter(idea => idea.phase === phase).map(idea => idea.turnId);
    const formatScore = (value: number | null) => value == null ? "Insufficient data" : round(value).toFixed(2);
    const formatDelta = (value: number | null) => value == null ? "Insufficient data" : `${value >= 0 ? "+" : ""}${round(value).toFixed(2)}`;
    const metricGroups: MetricGroup[] = [
      {
        title: "Agency & provenance",
        description: "Who opened, extended, and redirected conceptual territory",
        metrics: [
          metric({ key: "humanInitiation", name: "Human initiation", displayValue: humanInitiation == null ? "Insufficient data" : `${Math.round(humanInitiation * 100)}%`, rawValue: humanInitiation == null ? null : round(humanInitiation), note: `${humanRootIdeas.length} of ${rootIdeas.length} root ideas`, interpretation: "Share of new idea lineages that began with the participant.", confidence: confidenceForSample(rootIdeas.length), uncertainty: "Root-versus-derived status is inferred from textual provenance.", evidenceTurnIds: validEvidence(humanRootIdeas.map(idea => idea.turnId), turnIds) }),
          metric({ key: "humanBranchCreation", name: "Human branch creation", displayValue: String(humanBranches.length), rawValue: humanBranches.length, note: `${humanIdeas.length} human ideas total`, interpretation: "Human ideas judged to open a materially new direction.", confidence: confidenceForSample(humanIdeas.length), uncertainty: "Branch boundaries depend on model interpretation of conceptual difference.", evidenceTurnIds: validEvidence(humanBranches.map(idea => idea.turnId), turnIds) }),
          metric({ key: "aiBranchCreation", name: "AI branch creation", displayValue: String(aiBranches.length), rawValue: aiBranches.length, note: `${aiIdeas.length} AI ideas total`, interpretation: "AI ideas judged to open a materially new direction.", confidence: confidenceForSample(aiIdeas.length), uncertainty: "Questions without a conceptual seed are excluded.", evidenceTurnIds: validEvidence(aiBranches.map(idea => idea.turnId), turnIds) }),
          metric({ key: "aiAmplification", name: "AI amplification", displayValue: `${Math.round(draft.judgments.aiAmplification.score * 100)}%`, rawValue: round(draft.judgments.aiAmplification.score), note: draft.judgments.aiAmplification.rationale, interpretation: "Extent to which AI developed or strengthened an existing human direction instead of replacing it.", confidence: draft.judgments.aiAmplification.confidence, uncertainty: draft.judgments.aiAmplification.uncertainty, evidenceTurnIds: validEvidence(draft.judgments.aiAmplification.evidenceTurnIds, turnIds) }),
          metric({ key: "challengeRate", name: "Challenge rate", displayValue: humanMessages.length ? `${Math.round((challengeTurns.length / humanMessages.length) * 100)}%` : "Insufficient data", rawValue: humanMessages.length ? round(challengeTurns.length / humanMessages.length) : null, note: `${challengeTurns.length} of ${humanMessages.length} human turns`, interpretation: "How often the participant questioned, rejected, or reversed an AI contribution.", confidence: confidenceForSample(humanMessages.length), uncertainty: "Implicit disagreement may not be expressed strongly enough to classify.", evidenceTurnIds: validEvidence(challengeTurns, turnIds) }),
          metric({ key: "possibleAiPreemption", name: "Possible AI preemption", displayValue: String(draft.judgments.possibleAiPreemption.count), rawValue: draft.judgments.possibleAiPreemption.count, note: draft.judgments.possibleAiPreemption.rationale, interpretation: "Moments where an AI seed may have displaced or narrowed an emerging human direction.", confidence: draft.judgments.possibleAiPreemption.confidence, uncertainty: draft.judgments.possibleAiPreemption.uncertainty, evidenceTurnIds: validEvidence(draft.judgments.possibleAiPreemption.evidenceTurnIds, turnIds) }),
        ],
      },
      {
        title: "Movement & diversity",
        description: "Embedding-based distance and language-level variation",
        metrics: [
          metric({ key: "meanSemanticDistance", name: "Mean semantic distance", displayValue: formatScore(meanSemanticDistance), rawValue: meanSemanticDistance == null ? null : round(meanSemanticDistance), note: `${consecutiveDistances.length} idea transitions`, interpretation: "Average cosine distance between consecutive extracted ideas.", confidence: confidenceForSample(consecutiveDistances.length), uncertainty: `Sensitive to extraction choices and the ${embeddingModelId} embedding space.`, evidenceTurnIds: validEvidence(atomicIdeas.map(idea => idea.turnId), turnIds) }),
          metric({ key: "lexicalDiversity", name: "Lexical diversity", displayValue: formatScore(lexical), rawValue: lexical == null ? null : round(lexical), note: "unique words ÷ total words", interpretation: "Surface-level variety in the participant’s vocabulary.", confidence: confidenceForSample(humanMessages.length), uncertainty: "Short responses and word repetition can strongly affect this ratio.", evidenceTurnIds: validEvidence(humanMessages.map(message => message.id), turnIds) }),
          metric({ key: "conceptualDiversity", name: "Conceptual diversity", displayValue: formatScore(conceptualDiversity), rawValue: conceptualDiversity == null ? null : round(conceptualDiversity), note: `${pairwiseHumanDistances.length} human-idea pairs`, interpretation: "Average semantic distance across all extracted human ideas.", confidence: confidenceForSample(humanIdeas.length), uncertainty: "Depends on atomic idea extraction and embedding-model geometry.", evidenceTurnIds: validEvidence(humanIdeas.map(idea => idea.turnId), turnIds) }),
          metric({ key: "aiCreativePull", name: "AI creative pull", displayValue: formatScore(aiCreativePull), rawValue: aiCreativePull == null ? null : round(aiCreativePull), note: `${aiPullDistances.length} human ideas with AI parents`, interpretation: "Semantic closeness of human ideas to the AI ideas that directly preceded them; higher may indicate stronger convergence.", confidence: confidenceForSample(aiPullDistances.length), uncertainty: "Parent links are inferred, and closeness does not prove causal influence.", evidenceTurnIds: validEvidence(humanIdeas.filter(idea => idea.parentIds.some(parentId => aiIdeas.some(aiIdea => aiIdea.id === parentId))).map(idea => idea.turnId), turnIds) }),
          metric({ key: "divergenceRecovery", name: "Divergence recovery", displayValue: formatDelta(divergenceRecovery), rawValue: divergenceRecovery == null ? null : round(divergenceRecovery), note: "independent distance − co-creation distance", interpretation: "Whether human ideas moved farther from the AI idea centroid after the AI stopped contributing.", confidence: coCreationDistance != null && independentDistance != null ? "medium" : "low", uncertainty: "A short phase may contain too few ideas for a stable comparison.", evidenceTurnIds: validEvidence([...phaseEvidence("Co-creation"), ...phaseEvidence("Independent")], turnIds) }),
        ],
      },
      {
        title: "Creative operations",
        description: "Textual moves that changed or assessed the developing concept",
        metrics: [
          metric({ key: "synthesis", name: "Synthesis", displayValue: String(synthesisTurns.length), rawValue: synthesisTurns.length, note: "combined previously separate directions", interpretation: "Turns that combined multiple idea branches into a new whole.", confidence: confidenceForSample(synthesisTurns.length), uncertainty: "Simple aggregation may be difficult to distinguish from genuine synthesis.", evidenceTurnIds: validEvidence(synthesisTurns, turnIds) }),
          metric({ key: "reframing", name: "Reframing", displayValue: String(reframingTurns.length), rawValue: reframingTurns.length, note: "changed the problem or governing assumption", interpretation: "Turns that altered what problem was being solved or how it was defined.", confidence: confidenceForSample(reframingTurns.length), uncertainty: "Small wording changes are excluded unless they alter the conceptual frame.", evidenceTurnIds: validEvidence(reframingTurns, turnIds) }),
          metric({ key: "coCreativeEmergence", name: "Co-creative emergence", displayValue: String(draft.judgments.coCreativeEmergence.count), rawValue: draft.judgments.coCreativeEmergence.count, note: draft.judgments.coCreativeEmergence.rationale, interpretation: "Ideas judged to depend meaningfully on contributions from both human and AI.", confidence: draft.judgments.coCreativeEmergence.confidence, uncertainty: draft.judgments.coCreativeEmergence.uncertainty, evidenceTurnIds: validEvidence(draft.judgments.coCreativeEmergence.evidenceTurnIds, turnIds) }),
          metric({ key: "generativeFluency", name: "Generative fluency", displayValue: String(humanIdeas.length), rawValue: humanIdeas.length, note: "atomic human ideas", interpretation: "Number of distinct human-originated atomic ideas extracted from the conversation.", confidence: confidenceForSample(humanMessages.length), uncertainty: "Counts depend on how compound statements are split into atomic ideas.", evidenceTurnIds: validEvidence(humanIdeas.map(idea => idea.turnId), turnIds) }),
          metric({ key: "evaluativeDepth", name: "Evaluative depth", displayValue: formatScore(draft.judgments.evaluativeDepth.score), rawValue: round(draft.judgments.evaluativeDepth.score), note: draft.judgments.evaluativeDepth.rationale, interpretation: "Strength of explicit criteria, trade-offs, critique, and revision in the participant’s evaluation.", confidence: draft.judgments.evaluativeDepth.confidence, uncertainty: draft.judgments.evaluativeDepth.uncertainty, evidenceTurnIds: validEvidence(draft.judgments.evaluativeDepth.evidenceTurnIds, turnIds) }),
        ],
      },
      {
        title: "State comparison & timing",
        description: "Within-session change across protocol phases",
        metrics: [
          metric({ key: "baselineNovelty", name: "Baseline creativity", displayValue: formatScore(baselineNovelty), rawValue: baselineNovelty == null ? null : round(baselineNovelty), note: "novelty before AI concepts", interpretation: "Average minimum embedding distance from prior ideas during baseline.", confidence: confidenceForSample(atomicIdeas.filter(idea => idea.source === "human" && idea.phase === "Baseline").length), uncertainty: "This is a within-session novelty estimate, not a creativity score.", evidenceTurnIds: validEvidence(phaseEvidence("Baseline"), turnIds) }),
          metric({ key: "cuedNovelty", name: "Cued creativity", displayValue: formatScore(cuedNovelty), rawValue: cuedNovelty == null ? null : round(cuedNovelty), note: "novelty after the creativity cue", interpretation: "Average minimum embedding distance from prior ideas during the explicit creative-cue phase.", confidence: confidenceForSample(atomicIdeas.filter(idea => idea.source === "human" && idea.phase === "Creative cue").length), uncertainty: "Differences may reflect the prompt content or small sample size.", evidenceTurnIds: validEvidence(phaseEvidence("Creative cue"), turnIds) }),
          metric({ key: "postAiNovelty", name: "Post-AI creativity", displayValue: formatScore(postAiNovelty), rawValue: postAiNovelty == null ? null : round(postAiNovelty), note: "novelty after AI stopped contributing", interpretation: "Average minimum embedding distance from prior ideas during independent thinking.", confidence: confidenceForSample(atomicIdeas.filter(idea => idea.source === "human" && idea.phase === "Independent").length), uncertainty: "A single independent response cannot establish a stable post-AI effect.", evidenceTurnIds: validEvidence(phaseEvidence("Independent"), turnIds) }),
          metric({ key: "responseTiming", name: "Response timing", displayValue: medianResponseMs == null ? "Not recorded" : `${round(medianResponseMs / 1000, 1)} s`, rawValue: medianResponseMs, note: `${responseTimes.length} measured human responses`, interpretation: "Median time from the guide’s prompt appearing to the participant submitting a response.", confidence: confidenceForSample(responseTimes.length), uncertainty: "Timing includes reading, distraction, and typing; it is not a cognitive-processing measure.", evidenceTurnIds: validEvidence(humanMessages.filter(message => message.responseMs != null).map(message => message.id), turnIds) }),
        ],
      },
    ];

    const linkedTurns = new Set([
      ...atomicIdeas.map(idea => idea.turnId),
      ...annotations.filter(annotation => annotation.operations.length || annotation.atomicIdeaIds.length).map(annotation => annotation.turnId),
      ...metricGroups.flatMap(group => group.metrics.flatMap(item => item.evidenceTurnIds)),
    ]);
    const projection = firstPrincipalProjection(embeddings);
    const semanticTrajectory = atomicIdeas.map((idea, index) => ({
      ideaId: idea.id,
      x: atomicIdeas.length === 1 ? 50 : round(8 + (index / (atomicIdeas.length - 1)) * 84, 1),
      y: round(18 + projection[index] * 58, 1),
    }));

    const result: AnalysisResult = {
      generatedAt: new Date().toISOString(),
      model: modelId,
      embeddingModel: embeddingModelId,
      session: {
        turnCount: messages.length,
        humanTurns: humanMessages.length,
        atomicIdeaCount: atomicIdeas.length,
        evidenceLinkedPercent: Math.round((linkedTurns.size / messages.length) * 100),
        medianResponseMs,
      },
      personalReport: (() => {
        const phaseHasParticipantIdea = (phase: Phase) => atomicIdeas.some(idea => idea.source !== "ai" && idea.phase === phase);
        const comparisonReady = aiIdeas.length > 0 && phaseHasParticipantIdea("Baseline") && phaseHasParticipantIdea("Co-creation") && phaseHasParticipantIdea("Independent");
        const validSignals = draft.personalReport.aiEffectSignals.map(signal => ({ ...signal, evidenceTurnIds: validEvidence(signal.evidenceTurnIds, turnIds) }));
        const validCoaching = draft.personalReport.coachingPlan.map(item => ({ ...item, evidenceTurnIds: validEvidence(item.evidenceTurnIds, turnIds) }));
        const cappedConfidence: Confidence = draft.personalReport.aiEffectConfidence === "high" ? "medium" : draft.personalReport.aiEffectConfidence;
        return {
          ...draft.personalReport,
          aiEffectVerdict: comparisonReady ? draft.personalReport.aiEffectVerdict : "inconclusive" as const,
          aiEffectConfidence: comparisonReady ? cappedConfidence : "low" as const,
          aiEffectHeadline: comparisonReady ? draft.personalReport.aiEffectHeadline : "There is not enough contrast yet.",
          aiEffectExplanation: comparisonReady
            ? draft.personalReport.aiEffectExplanation
            : "This session ended before it contained enough human ideas before, during, and after AI input to support a useful comparison. Try a complete session for a preliminary read.",
          aiEffectSignals: comparisonReady ? validSignals : [{
            title: "Not enough comparison points",
            direction: "neutral" as const,
            explanation: "A useful session-level read needs human ideas from before AI contributes, while ideas are exchanged, and after the guide steps back.",
            evidenceTurnIds: validEvidence(humanMessages.map(message => message.id), turnIds),
          }],
          takeaways: draft.personalReport.takeaways.map(takeaway => ({ ...takeaway, evidenceTurnIds: validEvidence(takeaway.evidenceTurnIds, turnIds) })),
          coachingPlan: validCoaching,
        };
      })(),
      atomicIdeas,
      transcriptAnnotations: annotations,
      semanticTrajectory,
      metricGroups,
    };

    return Response.json(result);
  } catch (error) {
    console.error("Locus analysis failed:", error instanceof Error ? error.message : "Unknown analysis error");
    return Response.json({ error: "The conversation could not be analyzed. Please retry." }, { status: 502 });
  }
}
