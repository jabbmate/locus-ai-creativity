import type { AiEffectSignal, AnalysisQuality, AtomicIdea, PersonalReport, SessionMessage, TranscriptAnnotation } from "./analysis";
import { evidenceMessages, operationTurns } from "./analysis-validation";
import type { Review } from "./analysis-schemas";

// Credit is rendered from transcript-owned quotes, never a model-written ownership story.
export function buildPersonalReport(messages: SessionMessage[], ideas: AtomicIdea[], annotations: TranscriptAnnotation[], quality: AnalysisQuality, judgments: Review["judgments"]): PersonalReport {
  const role = (idea: AtomicIdea) => messages.find(m => m.id === idea.turnId)!.role;
  const human = ideas.filter(i => role(i) === "human");
  const ai = ideas.filter(i => role(i) === "ai");
  const text = (idea: AtomicIdea) => idea.quote;
  const transitions = human.flatMap(child => child.lineageStatus === "validated" ? child.parentIds.flatMap(id => {
    const parent = ai.find(i => i.id === id && i.lineageStatus === "validated");
    return parent ? [{ parent, child }] : [];
  }) : []);
  const helps = transitions.filter(t => t.child.source !== "uncertain" && t.parent.source !== "uncertain" && (t.child.relation === "develops" || t.child.relation === "combines"));
  // Rejection alone is agency, not evidence of harm. Restriction alone is not harm either.
  const first = human[0], last = human.filter(i => i.phase === "Independent").at(-1) ?? human.filter(i => i.phase !== "Reflection").at(-1);
  const observed: AiEffectSignal[] = transitions.slice(0, 3).map(({ parent, child }) => ({
    title: child.relation === "rejects" ? "You pushed back on AI" : child.relation === "repeats" ? "You stayed close to AI" : child.source === "co-created" ? "An idea used both contributions" : child.source === "uncertain" ? "The starting point is unclear" : "You changed what AI offered",
    direction: (quality.comparisonReady && helps.some(t => t.child.id === child.id) ? "boost" : "neutral") as "boost" | "neutral",
    explanation: `AI said: “${text(parent)}” You then said: “${text(child)}” ${child.relation === "rejects" ? "You chose to push back. That alone does not mean AI harmed your ideas." : "This looks like a connection between the two ideas. It does not prove AI caused the change."}`,
    evidenceTurnIds: evidenceMessages(messages, [parent.turnId, child.turnId]).map(m => m.id),
  }));
  const limiting = quality.comparisonReady && judgments.possibleAiPreemption.count > 0 && judgments.possibleAiPreemption.evidenceTurnIds.length > 0;
  if (limiting) {
    const evidence = evidenceMessages(messages, judgments.possibleAiPreemption.evidenceTurnIds);
    const aiTurn = evidence.find(m => m.role === "ai"), humanTurn = evidence.find(m => m.role === "human");
    observed.push({ title: "AI may have limited an idea", direction: "drag", explanation: `The analysis flagged a possible limit. AI said: “${aiTurn?.text}” You said: “${humanTurn?.text}” This is an uncertain reading, not proof that AI harmed your creativity.`, evidenceTurnIds: evidence.map(m => m.id) });
  }
  const statusText = quality.status === "incomplete_analysis"
    ? `${quality.protocolComplete ? "You completed the conversation. " : ""}Some parts could not be checked, so this analysis is incomplete. Retry the analysis to fill the gaps.`
    : quality.status === "early_exit"
      ? "You finished before answering all parts of the conversation. We can show the ideas we found, but there is not enough to judge AI's effect."
      : quality.baselineContaminated
        ? "AI offered an idea during the opening questions. That makes the starting comparison unclear, even though you completed the conversation."
        : quality.status === "insufficient_material"
          ? "You completed the conversation. We did not find enough clear ideas in each part to compare fairly. This is not a judgment of your creativity."
          : "This is our best reading of one conversation. We cannot know what you would have thought of without AI.";
  const boosted = quality.comparisonReady && helps.length > 0;
  const verdict = boosted && limiting ? "mixed" : limiting ? "constrained" : boosted ? "boosted" : quality.comparisonReady ? "no_clear_change" : "inconclusive";
  const middle = helps.find(t => t.child.id !== first?.id && t.child.id !== last?.id)?.child ?? human.find(i => i.id !== first?.id && i.id !== last?.id);
  const takeaways = [first, middle, ...(last && last.id !== first?.id ? [last] : [])].filter((i): i is AtomicIdea => !!i).map(idea => ({ title: idea.source === "co-created" ? "You expressed an idea built together" : idea.source === "uncertain" ? "You shared this; its origin is unclear" : idea.id === first?.id ? "You brought a starting idea" : idea.phase === "Independent" ? "You tried a new version yourself" : "You added another idea", explanation: `You said: “${text(idea)}”${idea.lineageStatus === "unresolved" ? " We could not confirm where this idea came from." : ""}`, evidenceTurnIds: idea.evidenceTurnIds }));
  const challengeIds = operationTurns(messages, annotations, "challenge", "human");
  const firstIds = first ? [first.turnId] : messages.filter(m => m.role === "human").slice(0, 1).map(m => m.id);
  const relevantIds = observed[0]?.evidenceTurnIds ?? firstIds;
  return {
    headline: "Here is what happened", headlineEmphasis: "to your ideas.",
    summary: first ? `You first said: “${text(first)}”${last && first.id !== last.id ? ` Later, you said: “${text(last)}”` : " We need more of your ideas to compare what happened next."}` : "We could not find clear ideas to compare in your answers. You can still read the full conversation in the research view.",
    aiEffectVerdict: verdict, aiEffectConfidence: "low",
    aiEffectHeadline: boosted && limiting ? "AI may have helped and limited your ideas." : limiting ? "AI may have limited your ideas here." : boosted ? "AI appears to have helped you build on an idea." : "AI's effect is not clear.",
    aiEffectExplanation: limiting ? "The analysis flagged a possible limiting effect in the conversation. Read the linked messages below to check that reading for yourself." : quality.comparisonReady && observed.length ? observed[0].explanation : statusText,
    aiEffectSignals: observed.length ? observed : [{ title: "What we can tell so far", direction: "neutral", explanation: statusText, evidenceTurnIds: firstIds }],
    phaseTakeaways: (["Baseline", "Co-creation", "Independent"] as const).map((phase, i) => ({ label: ["Your opening ideas", "While you worked with AI", "After AI stepped back"][i], explanation: human.find(h => h.phase === phase)?.quote ?? "No checked idea is available for this part." })),
    takeaways,
    coachingPlan: first ? [
      { title: "Keep a starting idea of your own", action: "Write two ideas before asking AI for suggestions. Save them so you can compare later.", whyThisFits: `Your starting answer included: “${text(first)}”`, tryPrompt: "Here are my two ideas: [paste them]. Ask me one question about each before suggesting any new ideas.", evidenceTurnIds: firstIds },
      { title: helps.length ? "Change one thing AI suggests" : "Ask for two different options", action: helps.length ? "Take one AI suggestion and change a part yourself. Say what you kept and what you replaced." : "Ask AI for two different options. Choose one part to keep and explain why.", whyThisFits: helps.length ? `You followed an AI idea with: “${text(helps[0].child)}”` : "We did not find a checked example of you building on an AI idea in this conversation. This is something to try, not a proven fix.", tryPrompt: "Give me two very different options for my idea. Then ask me what I would change instead of finishing it for me.", evidenceTurnIds: relevantIds },
      { title: challengeIds.length ? "Keep questioning AI's ideas" : "Try finding a weak spot", action: "Ask AI what might go wrong with an idea. Choose your own fix before reading its answer.", whyThisFits: challengeIds.length ? "You questioned an idea in this conversation. The linked messages show what you challenged." : "We did not find a clear moment where you questioned an AI suggestion. Testing one could give you another way to explore it.", tryPrompt: "Name one problem with this idea. Do not solve it yet. Ask me how I would fix it.", evidenceTurnIds: challengeIds.length ? challengeIds : firstIds },
    ] : [],
    bottomLine: boosted && limiting ? "You built on an AI idea, but the analysis also found a possible limit. Both readings are uncertain." : limiting ? "AI may have narrowed an idea here. The linked messages show why the analysis flagged it, but they cannot prove harm." : boosted ? "You built on something AI offered. That looks useful here, but it does not prove AI made you more creative." : "This conversation does not clearly show whether AI helped or limited your creativity.",
    bottomLineCaveat: statusText,
  };
}
