import type { AnalysisQuality, AtomicIdea, Metric, MetricGroup, SessionMessage, TranscriptAnnotation } from "./analysis";
import type { Review } from "./analysis-schemas";
import { evidenceMessages, operationTurns } from "./analysis-validation";

const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const round = (value: number) => Math.round(value * 100) / 100;
export function distance(a: number[], b: number[]) {
  const dot = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const norm = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0) * b.reduce((sum, value) => sum + value * value, 0));
  return Math.min(1, Math.max(0, 1 - dot / (norm || 1)));
}
export function calculateMetrics(messages: SessionMessage[], ideas: AtomicIdea[], annotations: TranscriptAnnotation[], embeddings: number[][], judgments: Review["judgments"], quality: AnalysisQuality) {
  const byTurn = new Map(messages.map(m => [m.id, m]));
  const humanTurns = messages.filter(m => m.role === "human");
  const human = ideas.filter(i => byTurn.get(i.turnId)?.role === "human");
  const ai = ideas.filter(i => byTurn.get(i.turnId)?.role === "ai");
  const vector = new Map(ideas.map((idea, index) => [idea.id, embeddings[index]]));
  const valid = ideas.filter(i => i.lineageStatus === "validated");
  const roots = valid.filter(i => !i.parentIds.length && i.source !== "uncertain");
  const humanRoots = roots.filter(i => i.source === "human");
  const words = humanTurns.flatMap(m => m.text.toLowerCase().match(/[a-z0-9']+/g) ?? []);
  const times = humanTurns.flatMap(m => m.responseMs == null ? [] : [m.responseMs]).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const medianResponseMs = !times.length ? null : times.length % 2 ? times[middle] : Math.round((times[middle - 1] + times[middle]) / 2);
  const novelty = ideas.map((idea, index) => index === 0 ? null : Math.min(...embeddings.slice(0, index).map(v => distance(v, vector.get(idea.id)!))));
  const aiParentPairs = valid.filter(i => byTurn.get(i.turnId)?.role === "human").flatMap(i => i.parentIds.flatMap(id => ai.some(a => a.id === id) ? [{ child: i, parent: ideas.find(p => p.id === id)! }] : []));
  const aiCentroid = ai.length ? embeddings[0].map((_, dim) => ai.reduce((sum, idea) => sum + vector.get(idea.id)![dim], 0) / ai.length) : null;
  const phaseHuman = (phase: string) => human.filter(i => i.phase === phase);
  const phaseDistance = (phase: string) => aiCentroid ? mean(phaseHuman(phase).map(i => distance(vector.get(i.id)!, aiCentroid))) : null;
  const during = phaseDistance("Co-creation"), after = phaseDistance("Independent");
  const ids = (items: AtomicIdea[]) => items.map(i => i.turnId);
  const complete = quality.status !== "incomplete_analysis";
  const mk = (key: string, name: string, value: number | null, evidence: number[], interpretation: string, note: string, options: Partial<Pick<Metric, "speakerScope" | "method" | "uncertainty">> & { percent?: boolean; integer?: boolean; signed?: boolean } = {}): Metric => {
    const observed = complete ? value : null;
    const linked = evidenceMessages(messages, evidence).map(m => m.id);
    return { key, name, rawValue: observed == null ? null : round(observed), displayValue: observed == null ? "Insufficient data" : options.percent ? `${Math.round(observed * 100)}%` : options.integer ? String(observed) : `${options.signed && observed >= 0 ? "+" : ""}${round(observed).toFixed(2)}`, note, interpretation, evidenceTurnIds: linked, supportingTurnCount: linked.length, method: options.method ?? "calculated", speakerScope: options.speakerScope ?? "human", uncertainty: !complete ? "Analysis is incomplete. This value is withheld until extraction and relationship validation succeed." : options.uncertainty ?? "Exploratory descriptor from model-extracted ideas. Supporting turns are not independent trials; reliability has not been established." };
  };
  const judgment = (key: keyof Review["judgments"], name: string, scope: Metric["speakerScope"] = "both") => {
    const item = judgments[key];
    const score = "score" in item ? item.score : item.count;
    return mk(key, name, item.evidenceTurnIds.length ? score : null, item.evidenceTurnIds, "Uncalibrated model interpretation of the cited conversation. This is not a percentage change in creativity.", item.rationale, { method: "model judgment", speakerScope: scope, integer: "count" in item, uncertainty: `${item.uncertainty} Model self-rated certainty is uncalibrated; no statistical confidence is implied.` });
  };
  const challenge = operationTurns(messages, annotations, "challenge", "human");
  const operation = (key: string, name: string, interpretation: string) => {
    const evidence = operationTurns(messages, annotations, key, "human");
    return mk(key, name, evidence.length, evidence, interpretation, `${evidence.length} unique human turns; AI turns excluded`, { integer: true });
  };
  const phaseMetric = (phase: string, key: string, name: string) => {
    const phaseIdeas = phaseHuman(phase).filter(i => novelty[ideas.indexOf(i)] != null);
    const value = phase === "Baseline" && quality.baselineContaminated ? null : mean(phaseIdeas.map(i => novelty[ideas.indexOf(i)]!));
    return mk(key, name, value, ids(phaseIdeas), "Mean minimum cosine distance to all earlier extracted ideas, for human contributions in this phase.", phase === "Baseline" && quality.baselineContaminated ? "AI concepts were detected before later baseline answers; baseline comparison withheld" : `${phaseIdeas.length} ideas across ${new Set(ids(phaseIdeas)).size} human turns; model-relative novelty, not a creativity score`);
  };
  const groups: MetricGroup[] = [
    { title: "Agency & provenance", description: "Speaker scope is explicit. Roots and branches require validated ancestry.", metrics: [
      mk("humanInitiation", "Human initiation", roots.length ? humanRoots.length / roots.length : null, ids(roots), "Human-originated roots divided by all validated roots.", `${humanRoots.length} of ${roots.length} validated roots`, { percent: true, speakerScope: "both" }),
      ...(["human", "ai"] as const).map(scope => { const branches = valid.filter(i => i.source === scope && i.isBranch); return mk(`${scope}BranchCreation`, `${scope === "human" ? "Human" : "AI"} branch creation`, branches.length, ids(branches), "Count of ideas interpreted as opening a different direction, by recorded origin.", `${branches.length} branches; shared and uncertain origins reported separately`, { integer: true, speakerScope: scope }); }),
      judgment("aiAmplification", "AI development of human ideas · model rating"),
      mk("challengeRate", "Human challenge rate", humanTurns.length ? challenge.length / humanTurns.length : null, challenge, "Unique human turns classified as challenge divided by all human turns. AI challenges are excluded.", `${challenge.length} of ${humanTurns.length} human turns`, { percent: true }),
      judgment("possibleAiPreemption", "Possible AI preemption · model count"),
    ] },
    { title: "Movement & diversity", description: "Distances describe embedding geometry, not brain activity or ability.", metrics: [
      mk("meanSemanticDistance", "Mean consecutive embedding distance", mean(embeddings.slice(1).map((e, i) => distance(embeddings[i], e))), ids(ideas), "Mean cosine distance between consecutive extracted ideas in transcript order.", `${Math.max(0, ideas.length - 1)} idea transitions`, { speakerScope: "both" }),
      mk("lexicalDiversity", "Lexical diversity", words.length ? new Set(words).size / words.length : null, humanTurns.map(m => m.id), "Unique human word tokens divided by total human word tokens.", "Surface vocabulary ratio; sensitive to length and repetition"),
      mk("conceptualDiversity", "Human pairwise embedding distance", mean(human.flatMap((a, i) => human.slice(i + 1).map(b => distance(vector.get(a.id)!, vector.get(b.id)!)))), ids(human), "Mean pairwise cosine distance across ideas expressed in human turns.", "Idea pairs from the same answer are not independent observations"),
      mk("aiCreativePull", "Closeness to direct AI parents", aiParentPairs.length ? 1 - mean(aiParentPairs.map(p => distance(vector.get(p.child.id)!, vector.get(p.parent.id)!)))! : null, aiParentPairs.flatMap(p => [p.parent.turnId, p.child.turnId]), "One minus mean distance between human-turn ideas and direct AI-turn parents.", `${aiParentPairs.length} inferred parent-child pairs; similarity does not establish influence`, { speakerScope: "both" }),
      mk("divergenceRecovery", "Post-collaboration distance change", during == null || after == null ? null : after - during, ids([...phaseHuman("Co-creation"), ...phaseHuman("Independent"), ...ai]), "Independent human-to-AI-centroid distance minus collaboration human-to-AI-centroid distance.", "Fixed-order, within-session difference; not a causal AI effect", { signed: true, speakerScope: "both" }),
    ] },
    { title: "Human operations & model interpretations", description: "Human operation counts exclude guide turns. Ratings are uncalibrated.", metrics: [
      operation("synthesis", "Human synthesis", "Unique human turns classified as combining different ideas. AI-only combinations are excluded."),
      operation("reframing", "Human reframing", "Unique human turns classified as changing the problem or assumptions. AI-only reframing is excluded."),
      judgment("coCreativeEmergence", "Co-created results · model count"),
      mk("generativeFluency", "Extracted human-turn ideas", human.length, ids(human), "Number of atomic contributions expressed in human turns, including shared or uncertain origins.", "Contribution count is not a count of independent trials or proof of original ownership", { integer: true }),
      judgment("evaluativeDepth", "Human evaluation · model rating", "human"),
    ] },
    { title: "Phase novelty & timing", description: "Question-only baseline is task-assisted; fixed-order phase contrasts cannot identify causality.", metrics: [
      phaseMetric("Baseline", "baselineNovelty", "Baseline embedding novelty"),
      phaseMetric("Creative cue", "cuedNovelty", "Cued embedding novelty"),
      phaseMetric("Independent", "postAiNovelty", "Post-AI embedding novelty"),
      mk("responseTiming", "Response timing (ms)", medianResponseMs, humanTurns.filter(m => m.responseMs != null).map(m => m.id), "Median recorded human response time. Includes reading, typing, distraction and thinking.", `${times.length} recorded human turns; not a processing-speed measure`, { integer: true }),
    ] },
  ];
  return { metricGroups: groups, medianResponseMs, semanticTrajectory: ideas.map((idea, i) => ({ ideaId: idea.id, x: ideas.length === 1 ? 50 : 8 + i / (ideas.length - 1) * 84, y: 82 - (novelty[i] ?? 0) * 64 })) };
}
