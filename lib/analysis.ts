export type Phase = "Baseline" | "Creative cue" | "Co-creation" | "Independent" | "Reflection";
export type Speaker = "human" | "ai";
export type Confidence = "high" | "medium" | "low";
export type IdeaSource = "human" | "ai" | "co-created" | "uncertain";

export type SessionMessage = {
  id: number;
  role: Speaker;
  text: string;
  phase: Phase;
  responseMs?: number | null;
};

export type AtomicIdea = {
  id: string;
  label: string;
  summary: string;
  source: IdeaSource;
  phase: Phase;
  turnId: number;
  parentIds: string[];
  isBranch: boolean;
  confidence: Confidence;
  quote: string;
  evidenceTurnIds: number[];
  lineageStatus: "validated" | "unresolved";
  relation: "new" | "develops" | "combines" | "rejects" | "repeats" | "uncertain";
};

export type TranscriptAnnotation = {
  turnId: number;
  summary: string;
  operations: string[];
  atomicIdeaIds: string[];
  confidence: Confidence;
};

export type Metric = {
  key: string;
  name: string;
  displayValue: string;
  rawValue: number | null;
  note: string;
  interpretation: string;
  uncertainty: string;
  evidenceTurnIds: number[];
  method: "calculated" | "model judgment";
  supportingTurnCount: number;
  speakerScope: "human" | "ai" | "both";
};

export type MetricGroup = {
  title: string;
  description: string;
  metrics: Metric[];
};

export type PersonalTakeaway = {
  title: string;
  explanation: string;
  evidenceTurnIds: number[];
};

export type AiEffectVerdict = "boosted" | "mixed" | "no_clear_change" | "constrained" | "inconclusive";

export type AiEffectSignal = {
  title: string;
  direction: "boost" | "drag" | "neutral";
  explanation: string;
  evidenceTurnIds: number[];
};

export type CoachingCard = {
  title: string;
  action: string;
  whyThisFits: string;
  tryPrompt: string;
  evidenceTurnIds: number[];
};

export type PhaseTakeaway = {
  label: string;
  explanation: string;
};

export type PersonalReport = {
  headline: string;
  headlineEmphasis: string;
  summary: string;
  aiEffectVerdict: AiEffectVerdict;
  aiEffectConfidence: Confidence;
  aiEffectHeadline: string;
  aiEffectExplanation: string;
  aiEffectSignals: AiEffectSignal[];
  phaseTakeaways: PhaseTakeaway[];
  takeaways: PersonalTakeaway[];
  coachingPlan: CoachingCard[];
  bottomLine: string;
  bottomLineCaveat: string;
};

export type SemanticPoint = {
  ideaId: string;
  x: number;
  y: number;
};

export type AnalysisResult = {
  generatedAt: string;
  model: string;
  embeddingModel: string;
  quality: AnalysisQuality;
  session: {
    turnCount: number;
    humanTurns: number;
    atomicIdeaCount: number;
    evidenceLinkedPercent: number;
    medianResponseMs: number | null;
  };
  personalReport: PersonalReport;
  atomicIdeas: AtomicIdea[];
  transcriptAnnotations: TranscriptAnnotation[];
  semanticTrajectory: SemanticPoint[];
  metricGroups: MetricGroup[];
};

export type TurnCoverage = { turnId: number; status: "covered" | "no_ideas" | "failed"; attempts: number; reason: string };
export type AnalysisDiagnostic = { code: string; turnId?: number; ideaId?: string; message: string };
export type AnalysisQuality = {
  protocolComplete: boolean;
  missingPhases: Phase[];
  status: "complete" | "early_exit" | "incomplete_analysis" | "insufficient_material";
  comparisonReady: boolean;
  baselineContaminated: boolean;
  coverage: TurnCoverage[];
  diagnostics: AnalysisDiagnostic[];
};
