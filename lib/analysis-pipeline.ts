import type { AnalysisDiagnostic, AnalysisResult, AtomicIdea, SessionMessage, TranscriptAnnotation, TurnCoverage } from "./analysis";
import { extractionSchema, reviewSchema, type Review } from "./analysis-schemas";
import { assessQuality, validateGenealogy, validateJudgments } from "./analysis-validation";
import { calculateMetrics } from "./analysis-metrics";
import { buildPersonalReport } from "./personal-report";

export type AnalysisDependencies = {
  extract: (message: SessionMessage, context: SessionMessage[], limit: number, signal?: AbortSignal) => Promise<unknown>;
  review: (messages: SessionMessage[], ideas: AtomicIdea[], signal?: AbortSignal) => Promise<unknown>;
  embed: (values: string[], signal?: AbortSignal) => Promise<number[][]>;
  model: string; embeddingModel: string;
};

// Injecting provider calls makes the real pipeline testable without network or paid requests.
export async function analyzeTranscript(messages: SessionMessage[], deps: AnalysisDependencies, signal?: AbortSignal): Promise<AnalysisResult> {
  const coverage: TurnCoverage[] = [];
  const extracted: AtomicIdea[] = [];
  const annotations: TranscriptAnnotation[] = [];
  const diagnostics: AnalysisDiagnostic[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, messages.length) }, async () => {
    while (cursor < messages.length) {
      signal?.throwIfAborted();
      const index = cursor++;
      const message = messages[index];
      let success = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const limit = attempt === 1 ? 12 : 24;
        try {
          const output = extractionSchema(limit).parse(await deps.extract(message, messages.slice(0, index), limit, signal));
          if (!output.complete || output.ideas.length >= limit || output.substantive !== (output.ideas.length > 0) || output.ideas.some(i => !message.text.includes(i.quote))) throw new Error("Incomplete extraction");
          const ideas = output.ideas.map((idea, i): AtomicIdea => ({ ...idea, id: `idea_${index + 1}_${i + 1}`, turnId: message.id, phase: message.phase, source: message.role, parentIds: [], isBranch: false, confidence: output.confidence, evidenceTurnIds: [message.id], lineageStatus: "unresolved", relation: "uncertain" }));
          extracted.push(...ideas);
          annotations.push({ turnId: message.id, summary: output.summary, operations: [...new Set(output.operations)], atomicIdeaIds: ideas.map(i => i.id), confidence: output.confidence });
          coverage.push({ turnId: message.id, status: output.substantive ? "covered" : "no_ideas", attempts: attempt, reason: output.reason });
          success = true;
          break;
        } catch { signal?.throwIfAborted(); }
      }
      if (!success) {
        coverage.push({ turnId: message.id, status: "failed", attempts: 2, reason: "Extraction failed, hit its limit, or returned unsupported quotes on both attempts." });
        diagnostics.push({ code: "extraction_incomplete", turnId: message.id, message: "This turn was not fully analyzed. Its ideas and dependent comparisons are unavailable." });
      }
    }
  }));
  const order = new Map(messages.map((m, i) => [m.id, i]));
  extracted.sort((a, b) => order.get(a.turnId)! - order.get(b.turnId)! || a.id.localeCompare(b.id, undefined, { numeric: true }));
  annotations.sort((a, b) => order.get(a.turnId)! - order.get(b.turnId)!);
  coverage.sort((a, b) => order.get(a.turnId)! - order.get(b.turnId)!);
  let review: Review | undefined;
  let validated: ReturnType<typeof validateGenealogy> | undefined;
  let judged: ReturnType<typeof validateJudgments> | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    try {
      review = reviewSchema.parse(await deps.review(messages, extracted, signal));
      validated = validateGenealogy(messages, extracted, review.relations);
      judged = validateJudgments(messages, review);
      if (!validated.diagnostics.length && !judged.diagnostics.length) break;
    } catch { signal?.throwIfAborted(); }
  }
  if (!review || !validated || !judged) throw new Error("Analysis review unavailable");
  diagnostics.push(...validated.diagnostics, ...judged.diagnostics);
  const ideas = validated.ideas;
  const quality = assessQuality(messages, ideas, coverage, diagnostics);
  const embeddings = ideas.length ? await deps.embed(ideas.map(i => `${i.label}: ${i.summary}`), signal) : [];
  if (embeddings.length !== ideas.length || embeddings.some(e => !e.length || e.some(n => !Number.isFinite(n)) || e.length !== embeddings[0].length || e.every(n => n === 0))) throw new Error("Invalid embeddings");
  const metrics = calculateMetrics(messages, ideas, annotations, embeddings, judged.judgments, quality);
  const linked = new Set([...ideas.map(i => i.turnId), ...annotations.filter(a => a.operations.length).map(a => a.turnId)]);
  return {
    generatedAt: new Date().toISOString(), model: deps.model, embeddingModel: deps.embeddingModel, quality,
    session: { turnCount: messages.length, humanTurns: messages.filter(m => m.role === "human").length, atomicIdeaCount: ideas.length, evidenceLinkedPercent: Math.round(linked.size / messages.length * 100), medianResponseMs: metrics.medianResponseMs },
    personalReport: buildPersonalReport(messages, ideas, annotations, quality, judged.judgments),
    atomicIdeas: ideas, transcriptAnnotations: annotations, semanticTrajectory: metrics.semanticTrajectory, metricGroups: metrics.metricGroups,
  };
}
