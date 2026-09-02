"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { AnalysisResult, AtomicIdea, Metric, Phase, SessionMessage as Message, TranscriptAnnotation } from "@/lib/analysis";

type Stage = "intro" | "session" | "analyzing" | "report" | "research";

const protocolFallbacks: { phase: Phase; text: string }[] = [
  { phase: "Baseline", text: "Now invent its mischievous cousin: a completely different solution to the same problem. It does not need to be sensible yet—what appears?" },
  { phase: "Creative cue", text: "Borrow one rule from somewhere absurdly unrelated—octopuses, karaoke, ant colonies, game shows, anything. What happens when that rule runs this place?" },
  { phase: "Co-creation", text: "Plot twist: the space remembers tiny acts of kindness, but only through a ridiculous physical ritual. What does it remember, and how does it reveal it?" },
  { phase: "Co-creation", text: "Lovingly sabotage that idea. What would make it creepy, annoying, or gloriously useless—and what better rule replaces the broken one?" },
  { phase: "Co-creation", text: "Mash your strongest idea into the least compatible thing we have mentioned. What odd little creature do they make together?" },
  { phase: "Independent", text: "Pull a trapdoor under the whole conversation: take the idea somewhere neither of us has mentioned. What unexpected version suddenly appears?" },
  { phase: "Reflection", text: "Final gut check: which idea would you actually steal from this conversation, and which moment made you think, ‘okay, that one is mine’?" },
];

const seedMessages: Message[] = [
  { id: 1, role: "ai", phase: "Baseline", text: "Pick a public place that is boring by accident—a bus stop, hallway, laundromat, parking garage, or somewhere else. Change one thing so strangers might actually enjoy interacting there. Weird answers are welcome. What would you try?" },
];

const analysisStages = [
  ["Extracting atomic ideas", "Separating the distinct concepts in this dialogue"],
  ["Reconstructing provenance", "Tracing which ideas seeded, challenged, and transformed others"],
  ["Mapping semantic movement", "Estimating distance and direction across conceptual space"],
  ["Comparing creative states", "Baseline → cued → co-created → independent"],
  ["Linking evidence", "Attaching every inference to the moment that supports it"],
];

const analysisRequestCache = new Map<string, Promise<AnalysisResult>>();

function requestTranscriptAnalysis(messages: Message[], force = false) {
  const key = JSON.stringify(messages);
  if (force) analysisRequestCache.delete(key);
  const existing = analysisRequestCache.get(key);
  if (existing) return existing;
  const request = fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) })
    .then(async response => {
      const data = await response.json() as AnalysisResult | { error?: string };
      if (!response.ok) throw new Error("error" in data ? data.error ?? "Analysis failed." : "Analysis failed.");
      return data as AnalysisResult;
    })
    .catch(error => { analysisRequestCache.delete(key); throw error; });
  analysisRequestCache.set(key, request);
  return request;
}

function Logo() {
  return <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full border border-[#0f6b4f]/20 bg-white/70"><span className="h-2.5 w-2.5 rounded-full bg-[#14a273] shadow-[0_0_16px_#14a273]" /></span><span className="text-sm font-semibold tracking-[-0.02em]">Locus</span></div>;
}

function Intro({ onStart }: { onStart: () => void }) {
  const [about, setAbout] = useState(false);
  return <main className="relative min-h-screen overflow-hidden bg-[#f4f5f0] text-[#17211d]">
    <div className="orb orb-one" aria-hidden="true" /><div className="orb orb-two" aria-hidden="true" />
    <nav className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-6 py-7 lg:px-10"><div className="flex items-center gap-3"><Logo /><span className="rounded-full border border-[#17211d]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f7974]">Research preview</span></div><button onClick={() => setAbout(true)} className="soft-button">About the study</button></nav>
    <section className="relative z-10 mx-auto grid min-h-[calc(100vh-94px)] max-w-[1240px] items-center gap-16 px-6 pb-20 pt-10 lg:grid-cols-[1.08fr_.92fr] lg:px-10 lg:pb-0 lg:pt-0">
      <div className="max-w-[720px]"><p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#26765e]"><span className="h-px w-8 bg-[#26765e]/50" />A five-minute creative duet</p><h1 className="max-w-[720px] text-[clamp(3.4rem,7vw,7.25rem)] font-medium leading-[0.88] tracking-[-0.075em]">See how your ideas <span className="font-serif italic text-[#167b5b]">move</span> with LLMs.</h1><p className="mt-8 max-w-[570px] text-[17px] leading-7 text-[#59645f]">Think alongside an AI in a guided creative experiment. We’ll map the moments you branch, reframe, synthesize, and take the conversation somewhere new.</p><div className="mt-10 flex flex-wrap items-center gap-5"><button onClick={onStart} className="primary-button group">Begin your session <span className="ml-3 inline-block transition group-hover:translate-x-1">→</span></button><span className="text-xs leading-5 text-[#7a847f]">No account needed<br />Conversation analyzed at the end</span></div></div>
      <IdeaPreview />
    </section>
    {about && <div className="modal-backdrop" onClick={() => setAbout(false)}><section className="modal-card" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAbout(false)} aria-label="Close">×</button><p className="eyebrow">Why this matters</p><h2 className="mt-4 text-4xl font-medium tracking-[-.055em]">Creativity is a process, not a score.</h2><p className="mt-5 leading-7 text-[#66706b]">AI can expand a person’s thinking, but it can also pull people toward the same ideas. Locus traces where ideas begin, bend, collide, and become yours—then turns those patterns into practical ways to work with AI.</p><div className="mt-7 grid gap-3 sm:grid-cols-3">{[["01","Ideas leave fingerprints"],["02","AI can widen or narrow"],["03","You get a practical read"]].map(([n,t]) => <div key={n} className="rounded-2xl bg-[#f5f6f1] p-4"><span className="text-[10px] text-[#8b948f]">{n}</span><strong className="mt-8 block text-sm">{t}</strong></div>)}</div><p className="mt-6 text-xs leading-5 text-[#738079]">To reduce bias, the conversation does not reveal or label its internal comparison protocol while you are taking part.</p><p className="disclaimer mt-5">This is an exploratory research prototype. Its metrics are experimental inferences, not validated psychological, neurological, diagnostic, or ability measures.</p></section></div>}
  </main>;
}

function IdeaPreview() {
  return <div className="landing-preview relative mx-auto w-full max-w-[470px]">
    <section className="cognition-intro">
      <div className="cognition-stage" role="img" aria-label="A floating white human brain beside a physical neural network">
        <div className="cognition-piece cognition-brain"><Image src="/locus-brain.png" alt="" width={768} height={773} priority /></div>
        <div className="cognition-piece cognition-network"><Image src="/locus-network.png" alt="" width={728} height={969} priority /></div>
      </div>
      <div className="cognition-labels" aria-hidden="true"><span>Human brain</span><span>Large language model</span></div>
      <div className="cognition-copy">
        <h2>What happens to human creativity when the human brain works with an LLM?</h2>
        <p>That is the question this experiment is designed to explore.</p>
      </div>
    </section>
    <div className="relative aspect-[.88] rounded-[2.25rem] border border-white/80 bg-white/55 p-5 shadow-[0_30px_90px_rgba(38,66,54,.12)] backdrop-blur-xl sm:p-7">
      <div className="flex items-center justify-between"><span className="eyebrow">Live idea trace</span><span className="flex items-center gap-2 text-[10px] text-[#6f7a75]"><i className="status-dot" /> Session 01</span></div>
      <IdeaTraceNetwork />
      <div className="mt-5 grid grid-cols-3 divide-x divide-[#17211d]/10">{[["12", "ideas"], ["6", "branches"], ["0.72", "distance"]].map(([value, label]) => <div className="px-4 first:pl-1" key={label}><strong className="block text-xl font-medium tracking-[-.04em]">{value}</strong><span className="text-[9px] uppercase tracking-[.14em] text-[#929b97]">{label}</span></div>)}</div>
    </div>
  </div>;
}

function IdeaTraceNetwork() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [links, setLinks] = useState<Array<{ id: string; x: number; y: number; length: number; angle: number }>>([]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const edges = [["a","b"], ["b","c"], ["c","d"], ["c","e"], ["c","f"]] as const;
    const measure = () => {
      const fieldBox = field.getBoundingClientRect();
      const next = edges.flatMap(([from, to]) => {
        const startBox = nodeRefs.current[from]?.getBoundingClientRect();
        const endBox = nodeRefs.current[to]?.getBoundingClientRect();
        if (!startBox || !endBox) return [];
        const x = startBox.left - fieldBox.left + startBox.width / 2;
        const y = startBox.top - fieldBox.top + startBox.height / 2;
        const endX = endBox.left - fieldBox.left + endBox.width / 2;
        const endY = endBox.top - fieldBox.top + endBox.height / 2;
        return [{ id: `${from}-${to}`, x, y, length: Math.hypot(endX - x, endY - y), angle: Math.atan2(endY - y, endX - x) * 180 / Math.PI }];
      });
      setLinks(next);
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  return <div ref={fieldRef} className="idea-field mt-8 h-[68%] rounded-[1.5rem] border border-[#17211d]/[.06] bg-[#f8faf6]/60">
    {links.map(link => <span key={link.id} className="trace-link" style={{ left: link.x, top: link.y, width: link.length, transform: `rotate(${link.angle}deg)` }} />)}
    {["a","b","c","d","e","f"].map((node,i) => <span ref={element => { nodeRefs.current[node] = element; }} key={node} className={`trace-node-anchor node-${node}`}><span className="idea-node"><b>{i === 1 || i === 4 ? "AI" : "H"}</b></span></span>)}
    <span className="trace-callout"><small>Largest leap</small><strong>Assumption reversal</strong></span>
  </div>;
}

function Session({ onFinish }: { onFinish: (messages: Message[]) => void }) {
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const lastPromptAt = useRef(0);
  const userTurns = messages.filter(m => m.role === "human").length;
  const replyIndex = Math.min(userTurns, protocolFallbacks.length - 1);

  useEffect(() => { lastPromptAt.current = performance.now(); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  async function send(e: FormEvent) {
    e.preventDefault(); if (!input.trim() || thinking) return;
    const text = input.trim();
    const currentPhase = messages.at(-1)?.phase ?? "Baseline";
    const newMessage: Message = { id: messages.length + 1, role: "human", text, phase: currentPhase, responseMs: Math.max(0, Math.round(performance.now() - lastPromptAt.current)) };
    const messagesWithReply = [...messages, newMessage];
    setMessages(messagesWithReply); setInput("");
    if (userTurns >= protocolFallbacks.length) {
      window.setTimeout(() => onFinish(messagesWithReply), 500);
      return;
    }
    setThinking(true);
    const nextPhase = protocolFallbacks[replyIndex].phase;
    let response = protocolFallbacks[replyIndex].text;
    if (process.env.NEXT_PUBLIC_AI_MODE === "live") {
      try {
        const result = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: messagesWithReply, phase: nextPhase }) });
        if (!result.ok) throw new Error("Live response unavailable");
        const data = await result.json() as { text?: string }; response = data.text ?? response;
      } catch { response = `${response} (Live mode was unavailable, so Locus continued with the local protocol.)`; }
    } else { await new Promise(resolve => setTimeout(resolve, 720)); }
    const aiMessage: Message = { id: messages.length + 2, role: "ai", text: response, phase: nextPhase };
    const completedMessages = [...messagesWithReply, aiMessage];
    setMessages(completedMessages); setThinking(false); lastPromptAt.current = performance.now();
  }

  return <main className="min-h-screen bg-[#f1f3ee] text-[#17211d]"><header className="sticky top-0 z-20 border-b border-[#17211d]/[.07] bg-[#f1f3ee]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-4 lg:px-8"><Logo /><div className="flex items-center gap-3"><span className="hidden rounded-full bg-[#e6ebe5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#65706a] sm:block">Creative playground</span><button disabled={userTurns === 0 || thinking} onClick={() => onFinish(messages)} className="soft-button" title={userTurns === 0 ? "Share one response before completing the session" : undefined}>Complete session</button></div></div></header>
    <section className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[1040px] flex-col"><div className="border-b border-[#17211d]/[.06] px-5 py-5 sm:px-8"><div className="mx-auto max-w-[800px]"><p className="eyebrow">Follow what surprises you</p><h1 className="mt-2 text-xl font-medium tracking-[-.03em]">A serious question with permission to get a little ridiculous.</h1><p className="mt-2 text-xs leading-5 text-[#7a847f]">There are no perfect answers here. Finish whenever the conversation feels complete.</p></div></div>
      <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8"><div className="mx-auto max-w-[800px] space-y-8">{messages.map(m => <article key={m.id} className={`message ${m.role}`}><div className="message-meta"><span>{m.role === "ai" ? "Locus guide" : "You"}</span></div><p>{m.text}</p></article>)}{thinking && <article className="message ai"><div className="message-meta"><span>Locus guide</span><small>thinking</small></div><div className="thinking-dots"><i /><i /><i /></div></article>}<div ref={bottom} /></div></div>
      <form onSubmit={send} className="sticky bottom-0 border-t border-[#17211d]/[.06] bg-[#f1f3ee]/95 px-5 py-5 backdrop-blur-xl sm:px-8"><div className="mx-auto max-w-[800px]"><div className="input-shell"><textarea id="session-response" aria-label="Your response" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Type your response…" rows={2} /><button disabled={!input.trim() || thinking} type="submit" aria-label="Send response"><span>Send</span><b>↑</b></button></div><div className="mt-2 flex justify-end text-[10px] text-[#8a948f]"><span>{input.length}/600</span></div></div></form>
    </section>
  </main>;
}

function Analyzing({ messages, onDone, onRestart }: { messages: Message[]; onDone: (analysis: AnalysisResult) => void; onRestart: () => void }) {
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setInterval(() => setStep(current => Math.min(analysisStages.length - 2, current + 1)), 1100);
    requestTranscriptAnalysis(messages, attempt > 0)
      .then(data => {
        if (!active) return;
        setStep(analysisStages.length - 1);
        window.setTimeout(() => onDone(data as AnalysisResult), 650);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Analysis failed."); })
      .finally(() => window.clearInterval(timer));
    return () => { active = false; window.clearInterval(timer); };
  }, [attempt, messages, onDone]);
  const retry = () => { setError(""); setStep(0); setAttempt(value => value + 1); };
  return <main className="analysis-screen"><div className="analysis-glow" /><section className="relative z-10 w-full max-w-[720px] px-6"><div className="mx-auto mb-12 h-28 w-28"><div className="scan-orbit"><i /><span /></div></div><p className="eyebrow text-center text-[#6fae96]">Building your creative map</p><h1 className="mt-4 text-center text-[clamp(2.4rem,5vw,4.4rem)] font-medium tracking-[-.06em] text-white">Reading the shape<br />of your thinking.</h1>{error ? <div className="mx-auto mt-10 max-w-[520px] rounded-2xl border border-white/10 bg-white/[.06] p-6 text-center"><strong className="text-sm text-white">We couldn’t finish the analysis.</strong><p className="mt-3 text-xs leading-5 text-white/50">{error} No substitute or example results have been shown.</p><div className="mt-6 flex justify-center gap-3"><button onClick={retry} className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#17211d]">Try analysis again</button><button onClick={onRestart} className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-white">Start over</button></div></div> : <div className="mx-auto mt-12 max-w-[560px] space-y-3">{analysisStages.map(([title,sub],i) => <div key={title} className={`analysis-step ${i < step ? "done" : i === step ? "current" : ""}`}><span>{i < step ? "✓" : `0${i+1}`}</span><div><strong>{title}</strong><small>{sub}</small></div></div>)}</div>}<p className="mt-10 text-center text-[10px] uppercase tracking-[.16em] text-white/35">Experimental inference · confidence recorded per metric</p></section></main>;
}

function Report({ analysis, transcript, onResearch, onRestart }: { analysis: AnalysisResult; transcript: Message[]; onResearch: () => void; onRestart: () => void }) {
  const [evidence, setEvidence] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const report = analysis.personalReport;
  const verdictPresentation = {
    boosted: { label: "Evidence of a boost", tone: "bg-[#dcece3]" },
    mixed: { label: "A mixed effect", tone: "bg-[#ebe6d7]" },
    no_clear_change: { label: "No clear change", tone: "bg-[#e5e8e4]" },
    constrained: { label: "Evidence of constraint", tone: "bg-[#eee2e1]" },
    inconclusive: { label: "Not enough evidence", tone: "bg-[#e5e8e4]" },
  }[report.aiEffectVerdict];
  const toneClass = verdictPresentation.tone;
  const evidenceMessage = evidence == null ? undefined : transcript.find(message => message.id === evidence);
  const evidenceAnnotation = evidence == null ? undefined : analysis.transcriptAnnotations.find(annotation => annotation.turnId === evidence);
  const copyPrompt = async (prompt: string, index: number) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(index);
      window.setTimeout(() => setCopiedPrompt(null), 1600);
    } catch {
      setCopiedPrompt(null);
    }
  };
  return <main className="min-h-screen bg-[#f4f5f0] text-[#17211d]"><nav className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-7"><div className="flex items-center gap-4"><Logo /><span className="hidden rounded-full border border-[#17211d]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-[#78827d] sm:block">Conversation analysis</span></div><div className="flex gap-2"><button onClick={onRestart} className="soft-button">New session</button><button onClick={onResearch} className="dark-button">See research details ↗</button></div></nav>
    <div className="mx-auto max-w-[1180px] px-6 pb-24"><header className="report-hero"><div><p className="eyebrow">Your session, in plain language</p><h1 className="mt-5 max-w-[820px] text-[clamp(3rem,6.5vw,6.4rem)] font-medium leading-[.92] tracking-[-.07em]">{report.headline} <span className="font-serif italic text-[#19785a]">{report.headlineEmphasis}</span></h1><p className="mt-6 max-w-[700px] text-base leading-7 text-[#66716b]">{report.summary}</p></div><div className={`rounded-[1.4rem] border border-[#287c60]/15 p-6 ${toneClass}`}><span className="text-[9px] font-semibold uppercase tracking-[.14em] text-[#487261]">Did AI help in this session?</span><strong className="mt-3 block text-2xl font-medium tracking-[-.04em]">{verdictPresentation.label}</strong><span className="mt-3 inline-block rounded-full bg-white/55 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.1em] text-[#65746d]">{report.aiEffectConfidence} signal confidence</span><p className="mt-3 text-[11px] leading-5 text-[#587067]">This is a preliminary within-session read, not proof that AI caused the change.</p></div></header>

      <section className="mt-12 overflow-hidden rounded-[2rem] border border-[#17211d]/[.07] bg-white/65"><div className="grid lg:grid-cols-[.72fr_1.28fr]"><div className={`p-7 sm:p-9 ${toneClass}`}><p className="eyebrow text-[#477361]">The effect of AI</p><h2 className="mt-5 text-3xl font-medium tracking-[-.045em]">{report.aiEffectHeadline}</h2><p className="mt-4 text-sm leading-6 text-[#5a6d65]">{report.aiEffectExplanation}</p><button onClick={onResearch} className="mt-7 text-xs font-semibold text-[#216b51]">Inspect the full evidence →</button></div><div className="grid divide-y divide-[#17211d]/[.07] sm:grid-cols-3 sm:divide-x sm:divide-y-0">{report.aiEffectSignals.map((signal, i) => <button onClick={() => setEvidence(signal.evidenceTurnIds[0] ?? null)} className="p-7 text-left sm:p-8" key={`${signal.title}-${i}`}><span className={`inline-block rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.1em] ${signal.direction === "boost" ? "bg-[#dcece3] text-[#267054]" : signal.direction === "drag" ? "bg-[#eee2e1] text-[#875853]" : "bg-[#e7e9e5] text-[#65706a]"}`}>{signal.direction === "boost" ? "Expansion signal" : signal.direction === "drag" ? "Constraint signal" : "Neutral signal"}</span><h3 className="mt-8 text-sm font-semibold">{signal.title}</h3><p className="mt-3 text-sm leading-6 text-[#68736d]">{signal.explanation}</p><span className="mt-6 block text-[9px] font-semibold uppercase tracking-[.1em] text-[#39745e]">See the moment →</span></button>)}</div></div></section>

      <section className="mt-14"><div className="max-w-[650px]"><p className="eyebrow">What to know about your thinking</p><h2 className="mt-4 text-3xl font-medium tracking-[-.045em]">Three useful takeaways from this conversation.</h2><p className="mt-3 text-sm leading-6 text-[#6a756f]">These describe what happened here—not fixed traits or limits.</p></div><div className="mt-7 grid gap-5 lg:grid-cols-3">{report.takeaways.map((takeaway, i) => <button onClick={() => setEvidence(takeaway.evidenceTurnIds[0] ?? null)} key={`${takeaway.title}-${i}`} className={`min-h-[255px] rounded-[1.7rem] p-7 text-left transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(23,33,29,.08)] ${i === 0 ? "bg-[#d8eadf]" : i === 1 ? "bg-[#e9e4d3]" : "bg-[#dfe3ed]"}`}><span className="text-[10px] text-[#77827c]">0{i + 1}</span><h3 className="mt-10 text-xl font-medium leading-7 tracking-[-.025em]">{takeaway.title}</h3><p className="mt-4 text-sm leading-6 text-[#5f6b65]">{takeaway.explanation}</p><span className="mt-7 block text-[10px] font-semibold uppercase tracking-[.1em] text-[#39745e]">See the moment →</span></button>)}</div></section>

      <section className="mt-14 rounded-[2rem] border border-[#17211d]/[.07] bg-[#eef1eb] p-7 sm:p-10"><div className="max-w-[760px]"><p className="eyebrow">Your AI creativity playbook</p><h2 className="mt-4 text-4xl font-medium tracking-[-.05em]">Use AI like this next time.</h2><p className="mt-4 text-sm leading-6 text-[#68736d]">These are specific moves drawn from what helped—or got in your way—during this conversation. Each includes language you can paste into any LLM.</p></div><div className="mt-8 grid gap-5 lg:grid-cols-3">{report.coachingPlan.map((item, index) => <article className="flex min-h-[390px] flex-col rounded-[1.6rem] border border-[#17211d]/[.07] bg-white/75 p-6" key={`${item.title}-${index}`}><span className="text-[9px] font-semibold uppercase tracking-[.12em] text-[#298060]">Move 0{index + 1}</span><h3 className="mt-6 text-xl font-medium leading-7 tracking-[-.03em]">{item.title}</h3><p className="mt-4 text-sm leading-6 text-[#59665f]">{item.action}</p><div className="mt-5 rounded-xl bg-[#17211d] p-4 text-white"><span className="text-[8px] font-semibold uppercase tracking-[.12em] text-white/40">Try saying</span><p className="mt-2 text-xs leading-5 text-white/75">“{item.tryPrompt}”</p><button onClick={() => copyPrompt(item.tryPrompt, index)} className="mt-4 text-[9px] font-semibold uppercase tracking-[.1em] text-[#7ed3b0]">{copiedPrompt === index ? "Copied ✓" : "Copy prompt"}</button></div><div className="mt-auto pt-5"><p className="text-[10px] leading-4 text-[#7b8580]"><strong className="text-[#59665f]">Why this fits you:</strong> {item.whyThisFits}</p><button onClick={() => setEvidence(item.evidenceTurnIds[0] ?? null)} className="mt-4 text-[9px] font-semibold uppercase tracking-[.1em] text-[#39745e]">See your evidence →</button></div></article>)}</div></section>

      <section className="panel mt-5 p-7 sm:p-9"><div className="flex items-start justify-between gap-6"><div><p className="eyebrow">How your ideas changed</p><h2 className="mt-3 text-2xl font-medium tracking-[-.04em]">Your path through the conversation.</h2><p className="mt-3 max-w-[570px] text-xs leading-5 text-[#75807a]">The horizontal direction follows time; vertical movement comes from an embedding-based projection of conceptual difference.</p></div><div className="legend"><span><i className="human-dot" /> You</span><span><i className="ai-dot" /> AI</span></div></div><SemanticMap analysis={analysis} /></section>

      <section className="mt-5 rounded-[2rem] bg-[#17211d] p-7 text-white sm:p-10"><div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow text-white/45">The bottom line</p><h2 className="mt-4 max-w-[780px] text-3xl font-medium tracking-[-.045em]">{report.bottomLine}</h2><p className="mt-3 max-w-[760px] text-sm leading-6 text-white/55">{report.bottomLineCaveat}</p></div><button onClick={onResearch} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-[#17211d]">Open the scientific report</button></div></section>
      <p className="disclaimer mx-auto mt-8 max-w-[900px] text-center">This report was generated from this conversation using transcript classification and embedding-based comparisons. It describes one interaction; it does not measure or diagnose creativity, intelligence, personality, cognition, or brain function. Open the research view to inspect evidence links and uncertainty for every metric.</p>
    </div>
    {evidenceMessage && <div className="evidence-toast"><div><span>Transcript evidence · Turn {evidenceMessage.id}</span><p>{evidenceMessage.text}</p>{evidenceAnnotation && <small className="mt-2 block text-[10px] text-white/40">{evidenceAnnotation.summary}</small>}</div><button onClick={() => setEvidence(null)}>×</button></div>}
  </main>;
}

function SemanticMap({ analysis }: { analysis: AnalysisResult }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [links, setLinks] = useState<Array<{ id: string; x: number; y: number; length: number; angle: number }>>([]);
  const nodes = useMemo(
    () => analysis.atomicIdeas.length <= 8
      ? analysis.atomicIdeas
      : Array.from({ length: 8 }, (_, index) => analysis.atomicIdeas[Math.round((index / 7) * (analysis.atomicIdeas.length - 1))]),
    [analysis.atomicIdeas],
  );
  const pointById = new Map(analysis.semanticTrajectory.map(point => [point.ideaId, point]));

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const edges = nodes.slice(1).map((node, index) => [nodes[index].id, node.id] as const);
    const measure = () => {
      const fieldBox = field.getBoundingClientRect();
      setLinks(edges.flatMap(([from, to]) => {
        const startBox = nodeRefs.current[from]?.getBoundingClientRect();
        const endBox = nodeRefs.current[to]?.getBoundingClientRect();
        if (!startBox || !endBox) return [];
        const x = startBox.left - fieldBox.left + startBox.width / 2;
        const y = startBox.top - fieldBox.top + startBox.height / 2;
        const endX = endBox.left - fieldBox.left + endBox.width / 2;
        const endY = endBox.top - fieldBox.top + endBox.height / 2;
        return [{ id: `${from}-${to}`, x, y, length: Math.hypot(endX - x, endY - y), angle: Math.atan2(endY - y, endX - x) * 180 / Math.PI }];
      }));
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [nodes]);

  return <div ref={fieldRef} className="semantic-map mt-8">
    <span className="semantic-path-label">{nodes.length} of {analysis.atomicIdeas.length} ideas · turn order</span>
    <div className="zone zone-a">Before AI</div><div className="zone zone-b">Working with AI</div><div className="zone zone-c">After AI stepped back</div>
    {links.map(link => <span key={link.id} className="semantic-link" style={{ left: link.x, top: link.y, width: link.length, transform: `rotate(${link.angle}deg)` }} />)}
    {nodes.map((idea, index) => { const point = pointById.get(idea.id); return <span ref={element => { nodeRefs.current[idea.id] = element; }} key={idea.id} className="semantic-node-anchor" style={{ left: `${point?.x ?? 50}%`, top: `${point?.y ?? 50}%` }}><button className={`map-node ${idea.source === "ai" ? "ai-map" : idea.source === "co-created" ? "cocreated-map" : ""}`} aria-label={`Step ${index + 1}: ${idea.label}, ${idea.source} idea`}><small>{String(index + 1).padStart(2, "0")}</small><b>{idea.source === "ai" ? "AI" : idea.source === "co-created" ? "H+AI" : "H"}</b><span>{idea.label}</span></button></span>; })}
  </div>;
}

function Research({ analysis, transcript, onBack }: { analysis: AnalysisResult; transcript: Message[]; onBack: () => void }) {
  const [tab, setTab] = useState<"metrics" | "genealogy" | "transcript">("metrics");
  const initialMetric = analysis.metricGroups[0]?.metrics[0];
  const [selected, setSelected] = useState(initialMetric?.evidenceTurnIds[0] ?? transcript[0]?.id ?? 1);
  const [selectedMetricKey, setSelectedMetricKey] = useState(initialMetric?.key ?? "");
  const evidence = transcript.find(message => message.id === selected);
  const annotation = analysis.transcriptAnnotations.find(item => item.turnId === selected);
  const selectedMetric = analysis.metricGroups.flatMap(group => group.metrics).find(item => item.key === selectedMetricKey);
  const linkedIdeas = analysis.atomicIdeas.filter(idea => annotation?.atomicIdeaIds.includes(idea.id));
  const selectMetric = (item: Metric) => { setSelectedMetricKey(item.key); if (item.evidenceTurnIds[0]) setSelected(item.evidenceTurnIds[0]); };
  return <main className="min-h-screen bg-[#eef1ec] text-[#17211d]"><header className="border-b border-[#17211d]/[.08] bg-[#f6f7f3]"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-5"><Logo /><span className="hidden h-5 w-px bg-[#17211d]/10 sm:block" /><span className="hidden text-xs text-[#6f7974] sm:block">Session 01 · {analysis.session.turnCount} turns · Conversation-derived</span></div><button onClick={onBack} className="soft-button">← Personal report</button></div></header>
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"><section className="flex flex-col justify-between gap-6 border-b border-[#17211d]/10 pb-7 lg:flex-row lg:items-end"><div><p className="eyebrow">Research dashboard</p><h1 className="mt-3 text-4xl font-medium tracking-[-.055em]">Creative process observatory</h1><p className="mt-3 max-w-[730px] text-sm leading-6 text-[#69736e]">Time-resolved, evidence-linked descriptors calculated from this human–AI interaction. Every value includes an uncertainty label and should be treated as exploratory.</p></div><div className="flex flex-wrap gap-2"><span className="data-pill">{analysis.session.atomicIdeaCount} atomic ideas</span><span className="data-pill">{analysis.session.turnCount} turns</span><span className="data-pill">{analysis.session.evidenceLinkedPercent}% evidence linked</span></div></section>
      <nav className="mt-6 flex gap-1 rounded-xl bg-[#dfe4de] p-1 sm:w-fit">{[["metrics","Metric matrix"],["genealogy","Idea genealogy"],["transcript","Annotated transcript"]].map(([id,label]) => <button onClick={() => setTab(id as typeof tab)} className={`dashboard-tab ${tab === id ? "active" : ""}`} key={id}>{label}</button>)}</nav>
      {tab === "metrics" && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5">{analysis.metricGroups.map(group => <section className="research-panel" key={group.title}><header><div><h2>{group.title}</h2><p>{group.description}</p></div><span>{group.metrics.length} measures</span></header><div className="metric-table">{group.metrics.map(item => <button onClick={() => selectMetric(item)} className="metric-row" key={item.key}><span className="metric-name">{item.name}</span><strong>{item.displayValue}</strong><span className="metric-note">{item.note}</span><span className={`confidence ${item.confidence}`}>{item.confidence} confidence</span><i>→</i></button>)}</div></section>)}</div><EvidencePanel message={evidence} annotation={annotation} metric={selectedMetric} ideas={linkedIdeas} /></div>}
      {tab === "genealogy" && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="research-panel min-h-[650px]"><header><div><h2>Atomic idea genealogy</h2><p>Parent–child inferences across human and AI contributions</p></div><div className="legend"><span><i className="human-dot" /> Human</span><span><i className="ai-dot" /> AI</span></div></header><Genealogy ideas={analysis.atomicIdeas} onSelect={setSelected} /></section><EvidencePanel message={evidence} annotation={annotation} ideas={linkedIdeas} /></div>}
      {tab === "transcript" && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="research-panel"><header><div><h2>Evidence-linked transcript</h2><p>Click an annotated turn to inspect extracted ideas and confidence</p></div><span>{analysis.session.turnCount} turns</span></header><div className="p-5 sm:p-7">{transcript.map(message => { const item = analysis.transcriptAnnotations.find(candidate => candidate.turnId === message.id); return <button key={message.id} onClick={() => { setSelected(message.id); setSelectedMetricKey(""); }} className={`transcript-row ${selected === message.id ? "selected" : ""}`}><span className={`speaker-token ${message.role}`}>{message.role === "human" ? "H" : "AI"}</span><div><div className="flex flex-wrap items-center gap-2"><strong>{message.role === "human" ? "Participant" : "Locus guide"}</strong><small>{message.phase}</small></div><p>{message.text}</p>{item && <span className="annotation-chip">{item.summary}</span>}</div><i>{String(message.id).padStart(2, "0")}</i></button>; })}</div></section><EvidencePanel message={evidence} annotation={annotation} ideas={linkedIdeas} /></div>}
      <section className="mt-5 rounded-2xl border border-[#9d7b42]/20 bg-[#f4eddf] p-5 text-xs leading-5 text-[#75633f]"><strong>Interpretation boundary.</strong> These values were calculated from this conversation using model-based extraction and classification plus {analysis.embeddingModel} embedding comparisons. They are not validated psychological or neuroscience measures and should not be used for diagnosis, selection, ranking, or claims about stable ability.</section>
    </div>
  </main>;
}

function EvidencePanel({ message, annotation, metric, ideas = [] }: { message?: Message; annotation?: TranscriptAnnotation; metric?: Metric; ideas?: AtomicIdea[] }) { return <aside className="sticky top-6 h-fit rounded-[1.4rem] border border-[#17211d]/[.08] bg-[#17211d] p-6 text-white"><p className="eyebrow text-white/40">Evidence inspector</p>{metric && <div className="mt-6 rounded-xl bg-white/[.06] p-4"><span className="text-[10px] uppercase tracking-[.12em] text-white/40">{metric.name}</span><p className="mt-2 text-xs leading-5 text-white/80">{metric.interpretation}</p><p className="mt-3 text-[10px] leading-4 text-white/40">Uncertainty: {metric.uncertainty}</p></div>}{message ? <><div className="mt-6 flex items-center gap-2"><span className={`speaker-token ${message.role}`}>{message.role === "human" ? "H" : "AI"}</span><div><strong className="block text-xs">Turn {String(message.id).padStart(2, "0")}</strong><small className="text-[10px] text-white/40">{message.phase}</small></div></div><blockquote className="mt-5 text-sm leading-6 text-white/75">“{message.text}”</blockquote>{annotation && <div className="mt-6 rounded-xl bg-white/[.06] p-4"><span className="text-[10px] uppercase tracking-[.12em] text-white/40">Linked inference</span><p className="mt-2 text-xs leading-5">{annotation.summary}</p>{annotation.operations.length > 0 && <p className="mt-3 text-[9px] uppercase tracking-[.1em] text-[#75c7a7]">{annotation.operations.join(" · ")}</p>}</div>}{ideas.length > 0 && <div className="mt-5 space-y-2">{ideas.map(idea => <div key={idea.id} className="rounded-lg bg-white/[.05] px-3 py-2"><span className="text-[9px] text-white/35">Atomic idea</span><strong className="mt-1 block text-[11px]">{idea.label}</strong></div>)}</div>}<div className="mt-6 grid grid-cols-2 gap-3"><div className="evidence-stat"><span>Annotation confidence</span><strong>{annotation?.confidence ?? "—"}</strong></div><div className="evidence-stat"><span>Metric confidence</span><strong>{metric?.confidence ?? "—"}</strong></div></div></> : <p className="mt-5 text-sm text-white/50">Select a metric or transcript annotation to inspect its supporting moment.</p>}<p className="mt-7 border-t border-white/10 pt-5 text-[10px] leading-4 text-white/35">Confidence reflects evidence clarity and method agreement—not scientific validity.</p></aside>; }

function Genealogy({ ideas, onSelect }: { ideas: AtomicIdea[]; onSelect: (id: number) => void }) { const byId = new Map(ideas.map(idea => [idea.id, idea])); return <div className="genealogy-grid">{ideas.map((idea, index) => <button onClick={() => onSelect(idea.turnId)} key={idea.id} className={`genealogy-card ${idea.source}`}><div className="flex items-center justify-between"><small>{idea.source === "human" ? "Human" : idea.source === "ai" ? "AI" : "Co-created"}</small><span>{String(index + 1).padStart(2, "0")}</span></div><strong>{idea.label}</strong><p>{idea.summary}</p><div className="mt-4 border-t border-[#17211d]/[.07] pt-3"><span>Turn {String(idea.turnId).padStart(2, "0")} · {idea.phase}</span>{idea.parentIds.length > 0 && <em>Built from: {idea.parentIds.map(parentId => byId.get(parentId)?.label ?? parentId).join(", ")}</em>}</div></button>)}</div>; }

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const restart = () => { setTranscript([]); setAnalysis(null); setStage("intro"); };
  if (stage === "intro") return <Intro onStart={() => setStage("session")} />;
  if (stage === "session") return <Session onFinish={messages => { setTranscript(messages); setStage("analyzing"); }} />;
  if (stage === "analyzing") return <Analyzing messages={transcript} onDone={result => { setAnalysis(result); setStage("report"); }} onRestart={restart} />;
  if (stage === "report" && analysis) return <Report analysis={analysis} transcript={transcript} onResearch={() => setStage("research")} onRestart={restart} />;
  if (stage === "research" && analysis) return <Research analysis={analysis} transcript={transcript} onBack={() => setStage("report")} />;
  return <Intro onStart={() => setStage("session")} />;
}
