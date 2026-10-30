import type { AtomicIdea, Phase, SessionMessage } from "../lib/analysis";
import type { AnalysisDependencies } from "../lib/analysis-pipeline";
import type { IdeaRelation, Review, TurnExtraction } from "../lib/analysis-schemas";

export const message = (id: number, role: SessionMessage["role"], phase: Phase, text: string): SessionMessage => ({ id, role, phase, text, responseMs: role === "human" ? 1000 : null });
export const courtroom = [
  message(10, "ai", "Baseline", "Choose a public place. What would you change?"),
  message(20, "human", "Baseline", "A shared jigsaw puzzle at a bus stop."),
  message(30, "ai", "Creative cue", "Borrow a rule from a place of your choice."),
  message(40, "human", "Creative cue", "A bus stop could borrow ideas from a game."),
  message(50, "ai", "Co-creation", "Try drawing on a courtroom, beehive, or submarine."),
  message(60, "human", "Co-creation", "Every claim needs evidence. Strangers could share clues before solving the puzzle."),
  message(70, "ai", "Co-creation", "What if everyone had to agree on the answer?"),
  message(80, "human", "Co-creation", "No, I reject everyone agreeing. People can post different answers."),
  message(90, "ai", "Independent", "What new version would you make?"),
  message(100, "human", "Independent", "I would make a mural that changes every week."),
  message(110, "ai", "Reflection", "Which part felt like yours?"),
  message(120, "human", "Reflection", "The evidence rule was my idea; AI gave me the courtroom theme."),
];
export const extracted = (text: string, count = 1): TurnExtraction => ({ substantive: count > 0, complete: true, reason: count ? "Substantive contribution." : "Question only.", ideas: Array.from({ length: count }, (_, i) => ({ label: `Idea ${i + 1}`, summary: text, quote: text })), operations: [], summary: text, confidence: "medium" });
export function idea(id: string, turn: SessionMessage, overrides: Partial<AtomicIdea> = {}): AtomicIdea {
  return { id, turnId: turn.id, phase: turn.phase, quote: turn.text, label: turn.text.slice(0, 40), summary: turn.text, source: turn.role, parentIds: [], isBranch: false, confidence: "medium", lineageStatus: "validated", relation: "new", evidenceTurnIds: [turn.id], ...overrides };
}
export function relation(idea: AtomicIdea, overrides: Partial<IdeaRelation> = {}): IdeaRelation {
  return { ideaId: idea.id, turnId: idea.turnId, phase: idea.phase, parentIds: [], origin: idea.source, relation: "new", isBranch: false, evidenceTurnIds: [idea.turnId], ...overrides };
}
export function reviewFor(messages: SessionMessage[], ideas: AtomicIdea[]): Review {
  const evidence = messages.map(m => m.id);
  const judgment = { score: 0.4, rationale: "Synthetic model judgment for tests.", confidence: "low" as const, uncertainty: "Uncalibrated.", evidenceTurnIds: evidence };
  return { relations: ideas.map(i => {
    const parent = ideas.find(p => p.quote === courtroom[4].text);
    const rejectionParent = ideas.find(p => p.quote === courtroom[6].text);
    if (i.quote === courtroom[5].text && parent) return relation(i, { parentIds: [parent.id], relation: "develops", evidenceTurnIds: [parent.turnId, i.turnId] });
    if (i.quote === courtroom[7].text && rejectionParent) return relation(i, { parentIds: [rejectionParent.id], relation: "rejects", evidenceTurnIds: [rejectionParent.turnId, i.turnId] });
    return relation(i);
  }).reverse(), judgments: { aiAmplification: judgment, evaluativeDepth: { ...judgment, evidenceTurnIds: messages.filter(m => m.role === "human").map(m => m.id) }, possibleAiPreemption: { ...judgment, count: 0 }, coCreativeEmergence: { ...judgment, count: 0 } } };
}
export function fakeProvider(overrides: Partial<AnalysisDependencies> = {}): AnalysisDependencies {
  return {
    model: "synthetic-test-model", embeddingModel: "synthetic-test-embeddings",
    async extract(m) {
      const output = extracted(m.text, m.role === "human" || [courtroom[4].text, courtroom[6].text].includes(m.text) ? 1 : 0);
      output.operations = m.text === courtroom[7].text ? ["challenge"] : [];
      return output;
    },
    async review(messages, ideas) { return reviewFor(messages, ideas); },
    async embed(values) { return values.map((_, i) => [1, (i % 7 + 1) / 8, (i % 5 + 1) / 6]); },
    ...overrides,
  };
}
