import type { AnalysisDiagnostic, AnalysisQuality, AtomicIdea, Phase, SessionMessage, Speaker, TranscriptAnnotation, TurnCoverage } from "./analysis";
import type { IdeaRelation, Review } from "./analysis-schemas";

export function evidenceMessages(messages: SessionMessage[], ids: number[]) {
  const wanted = new Set(ids);
  return messages.filter(message => wanted.has(message.id));
}

export function operationTurns(messages: SessionMessage[], annotations: TranscriptAnnotation[], operation: string, scope: Speaker | "both" = "human") {
  const ids = new Set(annotations.filter(a => a.operations.includes(operation)).map(a => a.turnId));
  return messages.filter(m => ids.has(m.id) && (scope === "both" || m.role === scope)).map(m => m.id);
}

export function validateGenealogy(messages: SessionMessage[], ideas: AtomicIdea[], relations: IdeaRelation[]) {
  if (new Set(messages.map(m => m.id)).size !== messages.length) throw new Error("Duplicate turn IDs");
  if (new Set(ideas.map(i => i.id)).size !== ideas.length) throw new Error("Duplicate idea IDs");
  const order = new Map(messages.map((m, i) => [m.id, i]));
  const byTurn = new Map(messages.map(m => [m.id, m]));
  const byId = new Map(ideas.map(i => [i.id, i]));
  const diagnostics: AnalysisDiagnostic[] = [];
  const cyclic = new Set<string>();
  const walk = (id: string, path: string[], visited: Set<string>) => {
    const position = path.indexOf(id);
    if (position >= 0) { path.slice(position).forEach(item => cyclic.add(item)); return; }
    if (visited.has(id)) return;
    visited.add(id);
    relations.find(r => r.ideaId === id)?.parentIds.forEach(parent => walk(parent, [...path, id], visited));
  };
  ideas.forEach(idea => walk(idea.id, [], new Set()));
  for (const r of relations) if (!byId.has(r.ideaId)) diagnostics.push({ code: "unknown_idea", ideaId: r.ideaId, message: "A relationship refers to an unknown idea." });
  const normalized = ideas.map(idea => {
    const turn = byTurn.get(idea.turnId);
    if (!turn) throw new Error("Idea references missing turn");
    const candidates = relations.filter(r => r.ideaId === idea.id);
    const r = candidates[0];
    const issues: string[] = [];
    if (cyclic.has(idea.id)) issues.push("cycle");
    if (candidates.length !== 1) issues.push("missing_or_duplicate_relationship");
    if (idea.phase !== turn.phase || (r && (r.phase !== turn.phase || r.turnId !== turn.id))) issues.push("phase_or_turn_mismatch");
    if (!turn.text.includes(idea.quote)) issues.push("unsupported_quote");
    if (r) {
      if (new Set(r.parentIds).size !== r.parentIds.length) issues.push("duplicate_parent");
      if (r.evidenceTurnIds.some(id => !byTurn.has(id) || order.get(id)! > order.get(turn.id)!)) issues.push("invalid_evidence");
      if (!r.evidenceTurnIds.includes(turn.id)) issues.push("missing_own_evidence");
      for (const parentId of r.parentIds) {
        const parent = byId.get(parentId);
        if (!parent) issues.push("missing_parent");
        else if (parentId === idea.id) issues.push("self_parent");
        // Same-turn relationships are deliberately disallowed: order within prose is ambiguous.
        else if (order.get(parent.turnId)! >= order.get(turn.id)!) issues.push("same_or_future_turn_parent");
        else if (!r.evidenceTurnIds.includes(parent.turnId)) issues.push("missing_parent_evidence");
      }
      if (r.relation !== "new" && r.relation !== "uncertain" && !r.parentIds.length) issues.push("derived_without_parent");
      if (r.relation === "new" && r.parentIds.length) issues.push("root_with_parents");
      if ((r.origin === "human" || r.origin === "ai") && r.origin !== turn.role && !(r.relation === "repeats" && r.parentIds.some(id => byId.get(id)?.source === r.origin))) issues.push("speaker_origin_mismatch");
      if (r.origin === "co-created" && !(r.parentIds.some(id => byTurn.get(byId.get(id)?.turnId ?? -1)?.role !== turn.role && byId.has(id)) && r.relation === "combines")) issues.push("unsupported_joint_origin");
    }
    for (const code of new Set(issues)) diagnostics.push({ code, ideaId: idea.id, turnId: turn.id, message: `Idea relationship unresolved: ${code.replaceAll("_", " ")}. Excluded from lineage-dependent metrics.` });
    return { ...idea, phase: turn.phase, source: issues.length || !r ? "uncertain" as const : r.origin, parentIds: issues.length || !r ? [] : r.parentIds, relation: issues.length || !r ? "uncertain" as const : r.relation, lineageStatus: issues.length || !r ? "unresolved" as const : "validated" as const, isBranch: !issues.length && !!r?.isBranch, evidenceTurnIds: issues.length || !r ? [turn.id] : evidenceMessages(messages, r.evidenceTurnIds).map(m => m.id) };
  });
  // Invalid ancestry cannot silently become a root or a valid ancestor downstream.
  let changed = true;
  while (changed) {
    changed = false;
    for (const idea of normalized) {
      if (idea.lineageStatus === "validated" && idea.parentIds.some(id => normalized.find(p => p.id === id)?.lineageStatus !== "validated")) {
        idea.lineageStatus = "unresolved"; idea.source = "uncertain"; idea.isBranch = false; changed = true;
        diagnostics.push({ code: "unresolved_ancestor", ideaId: idea.id, turnId: idea.turnId, message: "An ancestor is unresolved; this idea is excluded from lineage-dependent metrics." });
      }
    }
  }
  return { ideas: normalized.sort((a, b) => order.get(a.turnId)! - order.get(b.turnId)! || a.id.localeCompare(b.id, undefined, { numeric: true })), diagnostics };
}

export function assessQuality(messages: SessionMessage[], ideas: AtomicIdea[], coverage: TurnCoverage[], diagnostics: AnalysisDiagnostic[]): AnalysisQuality {
  const phases: Phase[] = ["Baseline", "Creative cue", "Co-creation", "Independent", "Reflection"];
  const missingPhases = phases.filter(phase => !messages.some(m => m.role === "human" && m.phase === phase));
  const failed = coverage.length !== messages.length || coverage.some(c => c.status === "failed");
  const order = new Map(messages.map((m, i) => [m.id, i]));
  const baselineContaminated = ideas.some(i => byRole(i) === "ai" && i.phase === "Baseline" && messages.some(m => m.role === "human" && m.phase === "Baseline" && order.get(m.id)! > order.get(i.turnId)!));
  function byRole(idea: AtomicIdea) { return messages.find(m => m.id === idea.turnId)?.role; }
  const hasIdea = (phase: Phase) => ideas.some(i => byRole(i) === "human" && i.phase === phase && i.lineageStatus === "validated");
  const comparisonReady = !missingPhases.length && !failed && !diagnostics.length && !baselineContaminated && ["Baseline", "Co-creation", "Independent"].every(p => hasIdea(p as Phase)) && ideas.some(i => byRole(i) === "ai");
  return { protocolComplete: !missingPhases.length, missingPhases, status: failed || diagnostics.length ? "incomplete_analysis" : missingPhases.length ? "early_exit" : !comparisonReady ? "insufficient_material" : "complete", comparisonReady, baselineContaminated, coverage, diagnostics };
}

export function validateJudgments(messages: SessionMessage[], review: Review) {
  const diagnostics: AnalysisDiagnostic[] = [];
  const judgments = structuredClone(review.judgments);
  for (const [key, item] of Object.entries(judgments)) {
    const supplied = evidenceMessages(messages, item.evidenceTurnIds);
    const evidence = key === "evaluativeDepth" ? supplied.filter(m => m.role === "human") : supplied;
    const expectsBoth = key !== "evaluativeDepth";
    const valid = supplied.length === new Set(item.evidenceTurnIds).size && evidence.some(m => m.role === "human") && (!expectsBoth || evidence.some(m => m.role === "ai"));
    if (!valid) diagnostics.push({ code: "unsupported_judgment", message: `${key} has missing or wrong-speaker evidence; its value is withheld.` });
    item.evidenceTurnIds = valid ? evidence.map(m => m.id) : [];
  }
  return { judgments, diagnostics };
}
