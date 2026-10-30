import { describe, expect, it } from "vitest";
import { operationTurns, validateGenealogy, evidenceMessages } from "../lib/analysis-validation";
import { requestSchema } from "../lib/analysis-schemas";
import { analyzeTranscript } from "../lib/analysis-pipeline";
import { calculateMetrics } from "../lib/analysis-metrics";
import { courtroom, extracted, fakeProvider, idea, message, relation, reviewFor } from "./fixtures";
import type { TranscriptAnnotation } from "../lib/analysis";

const annotations = (...ids: number[]): TranscriptAnnotation[] => ids.map(turnId => ({ turnId, operations: ["challenge", "synthesis", "reframing"], summary: "Operation", atomicIdeaIds: [], confidence: "low" }));

describe("speaker-scoped operations", () => {
  it("does not count an AI-only challenge as a human challenge", async () => {
    const result = await analyzeTranscript(courtroom.slice(0, 2), fakeProvider({ async extract(m) { const output = extracted(m.text, m.role === "human" ? 1 : 0); output.operations = m.role === "ai" ? ["challenge"] : []; return output; } }));
    const metric = result.metricGroups.flatMap(g => g.metrics).find(m => m.key === "challengeRate")!;
    expect(metric.rawValue).toBe(0); expect(metric.note).toBe("0 of 1 human turns"); expect(metric.evidenceTurnIds).toEqual([]);
  });
  it("counts one human turn out of two as 50%, deduplicates, and excludes AI evidence", () => {
    const messages = courtroom.slice(0, 4);
    const ops = annotations(10, 20, 20, 30, 999);
    for (const operation of ["challenge", "synthesis", "reframing"]) expect(operationTurns(messages, ops, operation)).toEqual([20]);
    const quality = { protocolComplete: false, missingPhases: [], status: "early_exit" as const, comparisonReady: false, baselineContaminated: false, coverage: [], diagnostics: [] };
    const metric = calculateMetrics(messages, [], ops, [], reviewFor(messages, []).judgments, quality).metricGroups.flatMap(g => g.metrics).find(m => m.key === "challengeRate")!;
    expect(metric.rawValue).toBe(0.5); expect(metric.displayValue).toBe("50%"); expect(metric.evidenceTurnIds).toEqual([20]);
    expect(metric.supportingTurnCount).toBe(1);
  });
  it("returns insufficient data with zero human turns", async () => {
    const messages = [message(1, "ai", "Baseline", "Question?"), message(2, "ai", "Baseline", "Another question?")];
    const result = await analyzeTranscript(messages, fakeProvider());
    expect(result.metricGroups.flatMap(g => g.metrics).find(m => m.key === "challengeRate")!.rawValue).toBeNull();
  });
});

describe("grounded personal report", () => {
  it("credits the courtroom domain and human evidence rule separately", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider());
    const story = result.personalReport.aiEffectSignals.find(s => s.evidenceTurnIds.includes(60))!;
    expect(story.explanation).toContain('AI said: “Try drawing on a courtroom, beehive, or submarine.”');
    expect(story.explanation).toContain('You then said: “Every claim needs evidence.');
    expect(story.evidenceTurnIds).toEqual([50, 60]);
    const rejection = result.personalReport.aiEffectSignals.find(s => s.title.includes("pushed back"))!;
    expect(rejection.evidenceTurnIds).toEqual([70, 80]);
    expect(evidenceMessages(courtroom, [80, 70, 70, 999]).map(m => m.id)).toEqual([70, 80]);
  });
  it("preserves co-created and uncertain origins", () => {
    const parent = idea("a", courtroom[4]); const child = idea("b", courtroom[5]);
    const mixed = validateGenealogy(courtroom, [child, parent], [relation(child, { origin: "co-created", relation: "combines", parentIds: ["a"], evidenceTurnIds: [50, 60] }), relation(parent)]);
    expect(mixed.ideas[1].source).toBe("co-created");
    const unsure = validateGenealogy(courtroom, [parent], [relation(parent, { origin: "uncertain", relation: "uncertain" })]);
    expect(unsure.ideas[0].source).toBe("uncertain");
  });
  it("keeps a possible limiting effect visible alongside a possible benefit", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider({ async review(messages, ideas) { const output = reviewFor(messages, ideas); output.judgments.possibleAiPreemption.count = 1; output.judgments.possibleAiPreemption.evidenceTurnIds = [70, 80]; return output; } }));
    expect(result.personalReport.aiEffectVerdict).toBe("mixed");
    expect(result.personalReport.aiEffectSignals.some(s => s.direction === "drag" && s.evidenceTurnIds.join() === "70,80")).toBe(true);
  });
  it("does not force a boost when no useful development is recorded", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider({ async review(messages, ideas) { const output = reviewFor(messages, ideas); output.relations = output.relations.map(r => r.relation === "develops" ? { ...r, relation: "repeats" } : r); return output; } }));
    expect(result.quality.status).toBe("complete"); expect(result.personalReport.aiEffectVerdict).toBe("no_clear_change");
  });
  it("withholds unsupported judgments and never renders invalid evidence as support", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider({ async review(messages, ideas) { const output = reviewFor(messages, ideas); output.judgments.aiAmplification.evidenceTurnIds = [999]; return output; } }));
    expect(result.quality.status).toBe("incomplete_analysis");
    expect(result.metricGroups.flatMap(g => g.metrics).every(m => !m.evidenceTurnIds.includes(999))).toBe(true);
    expect(result.personalReport.aiEffectVerdict).toBe("inconclusive");
  });
});

describe("genealogy validation", () => {
  const parent = idea("a", courtroom[1]), child = idea("b", courtroom[5]);
  it("uses transcript order even when records and relations arrive out of order", () => {
    const valid = validateGenealogy(courtroom, [child, parent], [relation(child, { parentIds: ["a"], relation: "develops", evidenceTurnIds: [20, 60] }), relation(parent)]);
    expect(valid.diagnostics).toEqual([]); expect(valid.ideas.map(i => i.id)).toEqual(["a", "b"]);
  });
  it.each([
    ["missing_parent", { parentIds: ["missing"], relation: "develops" }],
    ["self_parent", { parentIds: ["b"], relation: "develops" }],
    ["phase_or_turn_mismatch", { phase: "Baseline" }],
    ["invalid_evidence", { evidenceTurnIds: [999] }],
    ["derived_without_parent", { parentIds: [], relation: "develops" }],
    ["speaker_origin_mismatch", { origin: "ai" }],
  ] as const)("reports %s instead of making a false root", (code, update) => {
    const result = validateGenealogy(courtroom, [parent, child], [relation(parent), relation(child, update as Parameters<typeof relation>[1])]);
    expect(result.diagnostics.some(d => d.code === code)).toBe(true);
    expect(result.ideas[1].lineageStatus).toBe("unresolved");
    expect(result.ideas[1].source).toBe("uncertain");
  });
  it("rejects same-turn links, future parents, and cycles", () => {
    const same = idea("c", courtroom[5]);
    const result = validateGenealogy(courtroom, [parent, child, same], [relation(parent, { parentIds: ["b"], relation: "develops", evidenceTurnIds: [20, 60] }), relation(child, { parentIds: ["a", "c"], relation: "combines", evidenceTurnIds: [20, 60] }), relation(same)]);
    expect(result.diagnostics.some(d => d.code === "cycle")).toBe(true);
    expect(result.diagnostics.some(d => d.code === "same_or_future_turn_parent")).toBe(true);
  });
  it("rejects duplicate IDs and missing turns", () => {
    expect(() => validateGenealogy(courtroom, [parent, parent], [])).toThrow("Duplicate idea IDs");
    expect(() => validateGenealogy([...courtroom, courtroom[0]], [], [])).toThrow("Duplicate turn IDs");
    expect(() => validateGenealogy(courtroom, [{ ...parent, turnId: 999 }], [])).toThrow("missing turn");
    expect(requestSchema.safeParse({ messages: [courtroom[0], courtroom[0]] }).success).toBe(false);
  });
  it("diagnoses missing relationships and does not use an unresolved ancestor as a root", () => {
    const result = validateGenealogy(courtroom, [parent, child], [relation(child, { parentIds: ["a"], relation: "develops", evidenceTurnIds: [20, 60] })]);
    expect(result.diagnostics.some(d => d.code === "missing_or_duplicate_relationship")).toBe(true);
    expect(result.diagnostics.some(d => d.code === "unresolved_ancestor")).toBe(true);
    expect(result.ideas.every(i => i.lineageStatus === "unresolved")).toBe(true);
  });
});

describe("coverage and completion", () => {
  it("preserves final independent ideas after more than 30 early ideas", async () => {
    const concepts = ["swap seedlings", "paint a shared mural", "build a tiny library", "repair bicycles", "trade recipes", "play a team puzzle", "share music", "record neighborhood stories", "make a shadow theatre"];
    const messages = courtroom.map(m => m.role === "human" && m.phase !== "Independent" ? { ...m, text: concepts.map(c => `At turn ${m.id}, ${c}.`).join(" | ") } : m);
    const result = await analyzeTranscript(messages, fakeProvider({ async extract(m) {
      const output = extracted(m.text, m.role === "human" || [50, 70].includes(m.id) ? 1 : 0);
      if (m.text.includes(" | ")) { output.summary = "Several distinct public-space options."; output.ideas = m.text.split(" | ").map(quote => ({ quote, summary: quote, label: quote.slice(0, 60) })); }
      return output;
    } }));
    expect(result.atomicIdeas.length).toBeGreaterThan(30);
    expect(result.atomicIdeas.some(i => i.turnId === 100)).toBe(true);
    expect(result.quality.status).toBe("complete");
  });
  it("distinguishes early exit from completed but non-substantive material", async () => {
    expect((await analyzeTranscript(courtroom.slice(0, 2), fakeProvider())).quality.status).toBe("early_exit");
    const result = await analyzeTranscript(courtroom, fakeProvider({ async extract(m) { return extracted(m.text, 0); } }));
    expect(result.quality.protocolComplete).toBe(true); expect(result.quality.status).toBe("insufficient_material");
    expect(result.personalReport.aiEffectExplanation).toContain("You completed");
    expect(result.personalReport.aiEffectExplanation).not.toContain("ended before");
  });
  it("retries a capped turn and preserves late coverage", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider({ async extract(m, _context, limit) { return extracted(m.text, m.id === 20 ? limit === 12 ? 12 : 13 : m.role === "human" || [50, 70].includes(m.id) ? 1 : 0); } }));
    expect(result.quality.coverage.find(c => c.turnId === 20)?.attempts).toBe(2);
    expect(result.quality.status).toBe("complete"); expect(result.atomicIdeas.some(i => i.turnId === 100)).toBe(true);
  });
  it.each(["late", "early"])("withholds values when a %s turn remains capped after retry", async which => {
    const result = await analyzeTranscript(courtroom, fakeProvider({ async extract(m, _context, limit) { return extracted(m.text, m.id === (which === "late" ? 100 : 20) ? limit : m.role === "human" || [50, 70].includes(m.id) ? 1 : 0); } }));
    expect(result.quality.status).toBe("incomplete_analysis"); expect(result.quality.protocolComplete).toBe(true);
    expect(result.personalReport.aiEffectVerdict).toBe("inconclusive");
    expect(result.metricGroups.flatMap(g => g.metrics).every(m => m.rawValue === null)).toBe(true);
    expect(result.personalReport.aiEffectExplanation).toContain("analysis is incomplete");
    expect(result.personalReport.aiEffectExplanation).not.toContain("finished before");
  });
  it("retries unsupported quotes and never returns them as evidence", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider({ async extract(m) { const output = extracted(m.text); if (m.id === 100) output.ideas[0].quote = "Not actually said"; return output; } }));
    expect(result.quality.coverage.find(c => c.turnId === 100)?.status).toBe("failed");
    expect(result.atomicIdeas.some(i => i.quote === "Not actually said")).toBe(false);
  });
  it("detects AI concepts in baseline before subsequent human answers", async () => {
    const messages = [message(1, "ai", "Baseline", "Try a jigsaw puzzle."), message(2, "human", "Baseline", "I will make a puzzle.")];
    const result = await analyzeTranscript(messages, fakeProvider({ async extract(m) { return extracted(m.text); } }));
    expect(result.quality.baselineContaminated).toBe(true);
    expect(result.metricGroups.flatMap(g => g.metrics).find(m => m.key === "baselineNovelty")?.rawValue).toBeNull();
  });
  it("plots minimum earlier embedding distance, not a principal component", async () => {
    const result = await analyzeTranscript(courtroom, fakeProvider());
    expect(result.semanticTrajectory[0].y).toBe(82);
    expect(result.metricGroups.flatMap(g => g.metrics).every(m => !m.name.includes("creativity"))).toBe(true);
    expect(result.metricGroups.flatMap(g => g.metrics).filter(m => m.method === "model judgment").every(m => !m.displayValue.includes("%"))).toBe(true);
  });
});
