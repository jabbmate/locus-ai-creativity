"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { SessionAnalysisCache } from "@/lib/session-analysis";
import { evidenceMessages } from "@/lib/analysis-validation";
import type { AnalysisResult, AtomicIdea, Metric, Phase, SessionMessage as Message } from "@/lib/analysis";

type Stage = "intro" | "session" | "analyzing" | "report" | "research";

const protocolFallbacks: { phase: Phase; text: string }[] = [
  { phase: "Baseline", text: "Now invent its mischievous cousin: a completely different solution to the same problem. It does not need to be sensible yet—what appears?" },
  { phase: "Creative cue", text: "Choose a place or activity that feels completely unrelated. Borrow one rule from it. What happens when that rule runs this place?" },
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
      <div className="flex items-center justify-between"><span className="eyebrow">Example idea trace</span><span className="flex items-center gap-2 text-[10px] text-[#6f7a75]"><i className="status-dot" /> Illustrative example</span></div>
      <p className="mt-3 text-[10px] text-[#6f7a75]">Example values, not a live session or measured results.</p>
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
  const chatController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const userTurns = messages.filter(m => m.role === "human").length;
  const replyIndex = Math.min(userTurns, protocolFallbacks.length - 1);

  useEffect(() => { mounted.current = true; lastPromptAt.current = performance.now(); return () => { mounted.current = false; chatController.current?.abort(); }; }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  async function send(e: FormEvent) {
    e.preventDefault(); if (!input.trim() || thinking) return;
    const text = input.trim();
    const currentPhase = messages.at(-1)?.phase ?? "Baseline";
    const newMessage: Message = { id: messages.length + 1, role: "human", text, phase: currentPhase, responseMs: Math.max(0, Math.round(performance.now() - lastPromptAt.current)) };
    const messagesWithReply = [...messages, newMessage];
    setMessages(messagesWithReply); setInput("");
    if (userTurns >= protocolFallbacks.length) {
      onFinish(messagesWithReply);
      return;
    }
    setThinking(true);
    const nextPhase = protocolFallbacks[replyIndex].phase;
    let response = protocolFallbacks[replyIndex].text;
    if (process.env.NEXT_PUBLIC_AI_MODE === "live") {
      try {
        chatController.current = new AbortController();
        const result = await fetch("/api/chat", { signal: chatController.current.signal, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: messagesWithReply, phase: nextPhase }) });
        if (!result.ok) throw new Error("Live response unavailable");
        const data = await result.json() as { text?: string }; response = data.text ?? response;
      } catch { response = `${response} (Live mode was unavailable, so Locus continued with the local protocol.)`; }
    } else { await new Promise(resolve => setTimeout(resolve, 720)); }
    if (!mounted.current) return;
    const aiMessage: Message = { id: messages.length + 2, role: "ai", text: response, phase: nextPhase };
    const completedMessages = [...messagesWithReply, aiMessage];
    setMessages(completedMessages); setThinking(false); lastPromptAt.current = performance.now();
  }

  return <main className="min-h-screen bg-[#f1f3ee] text-[#17211d]"><header className="sticky top-0 z-20 border-b border-[#17211d]/[.07] bg-[#f1f3ee]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-4 lg:px-8"><Logo /><div className="flex items-center gap-3"><span className="hidden rounded-full bg-[#e6ebe5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#65706a] sm:block">Creative playground</span><button disabled={userTurns === 0 || thinking} onClick={() => onFinish(messages)} className="soft-button" title={userTurns === 0 ? "Share one response before completing the session" : undefined}>Complete session</button></div></div></header>
    <section className="mx-auto flex min-h-[calc(100vh-65px)] max-w-[1040px] flex-col"><div className="border-b border-[#17211d]/[.06] px-5 py-5 sm:px-8"><div className="mx-auto max-w-[800px]"><p className="eyebrow">Follow what surprises you</p><h1 className="mt-2 text-xl font-medium tracking-[-.03em]">A serious question with permission to get a little ridiculous.</h1><p className="mt-2 text-xs leading-5 text-[#7a847f]">There are no perfect answers here. Finish whenever the conversation feels complete.</p></div></div>
      <div className="flex-1 overflow-y-auto px-5 py-8 sm:px-8"><div className="mx-auto max-w-[800px] space-y-8">{messages.map(m => <article key={m.id} className={`message ${m.role}`}><div className="message-meta"><span>{m.role === "ai" ? "Locus guide" : "You"}</span></div><p>{m.text}</p></article>)}{thinking && <article className="message ai"><div className="message-meta"><span>Locus guide</span><small>thinking</small></div><div className="thinking-dots"><i /><i /><i /></div></article>}<div ref={bottom} /></div></div>
      <form onSubmit={send} className="sticky bottom-0 border-t border-[#17211d]/[.06] bg-[#f1f3ee]/95 px-5 py-5 backdrop-blur-xl sm:px-8"><div className="mx-auto max-w-[800px]"><p id="session-privacy" className="mb-3 text-xs leading-5 text-[#59645f]">Your text and response timing are processed for this experiment. In live mode, messages go to the AI provider as you chat; the full conversation is sent for analysis when you finish. Avoid private or identifying details. <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy and retention</a></p><div className="input-shell"><textarea id="session-response" aria-label="Your response" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }} placeholder="Type your response…" maxLength={600} rows={2} aria-describedby="session-privacy" /><button disabled={!input.trim() || thinking} type="submit" aria-label="Send response"><span>Send</span><b>↑</b></button></div><div className="mt-2 flex justify-end text-[10px] text-[#8a948f]"><span>{input.length}/600</span></div></div></form>
    </section>
  </main>;
}

function Analyzing({ messages, cache, onDone, onRestart }: { messages: Message[]; cache: SessionAnalysisCache; onDone: (analysis: AnalysisResult) => void; onRestart: () => void }) {
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let completionTimer: number | undefined;
    const timer = window.setInterval(() => setStep(current => Math.min(analysisStages.length - 2, current + 1)), 1100);
    cache.request(messages, attempt > 0)
      .then(data => {
        if (!active) return;
        setStep(analysisStages.length - 1);
        completionTimer = window.setTimeout(() => { if (active) onDone(data as AnalysisResult); }, 650);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Analysis failed."); })
      .finally(() => window.clearInterval(timer));
    return () => { active = false; window.clearInterval(timer); window.clearTimeout(completionTimer); };
  }, [attempt, messages, onDone, cache]);
  const retry = () => { setError(""); setStep(0); setAttempt(value => value + 1); };
  return <main className="analysis-screen"><div className="analysis-glow" /><section className="relative z-10 w-full max-w-[720px] px-6"><div className="mx-auto mb-12 h-28 w-28"><div className="scan-orbit"><i /><span /></div></div><p className="eyebrow text-center text-[#6fae96]">Building your creative map</p><h1 className="mt-4 text-center text-[clamp(2.4rem,5vw,4.4rem)] font-medium tracking-[-.06em] text-white">Reading the shape<br />of your thinking.</h1>{error ? <div className="mx-auto mt-10 max-w-[520px] rounded-2xl border border-white/10 bg-white/[.06] p-6 text-center"><strong className="text-sm text-white">We couldn’t finish the analysis.</strong><p className="mt-3 text-xs leading-5 text-white/50">{error} No substitute or example results have been shown.</p><div className="mt-6 flex justify-center gap-3"><button onClick={retry} className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#17211d]">Try analysis again</button><button onClick={onRestart} className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold text-white">Start over</button></div></div> : <div className="mx-auto mt-12 max-w-[560px] space-y-3">{analysisStages.map(([title,sub],i) => <div key={title} className={`analysis-step ${i < step ? "done" : i === step ? "current" : ""}`}><span>{i < step ? "✓" : `0${i+1}`}</span><div><strong>{title}</strong><small>{sub}</small></div></div>)}</div>}<p className="mt-10 text-center text-[10px] uppercase tracking-[.16em] text-white/35">Exploratory analysis · no validated creativity score</p><button onClick={onRestart} className="mx-auto mt-5 block text-sm text-white underline">Start new session</button></section></main>;
}

function Report({ analysis, transcript, onResearch, onRestart, onRetry }: { analysis: AnalysisResult; transcript: Message[]; onResearch: () => void; onRestart: () => void; onRetry: () => void }) {
  const [evidence, setEvidence] = useState<number[] | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const report = analysis.personalReport;
  const verdictPresentation = {
    boosted: { label: "AI appears to have helped", tone: "bg-[#dcece3]" },
    mixed: { label: "AI helped and got in the way", tone: "bg-[#ebe6d7]" },
    no_clear_change: { label: "AI did not clearly change your ideas", tone: "bg-[#e5e8e4]" },
    constrained: { label: "AI may have boxed your ideas in", tone: "bg-[#eee2e1]" },
    inconclusive: { label: "Not enough conversation to tell", tone: "bg-[#e5e8e4]" },
  }[report.aiEffectVerdict];
  const toneClass = verdictPresentation.tone;
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
    <div className="mx-auto max-w-[1180px] px-6 pb-24"><AnalysisStatus analysis={analysis} onRetry={onRetry} /><header className="report-hero"><div><p className="eyebrow">What happened to your ideas</p><h1 className="mt-5 max-w-[820px] text-[clamp(3rem,6.5vw,6.4rem)] font-medium leading-[.92] tracking-[-.07em]">{report.headline} <span className="font-serif italic text-[#19785a]">{report.headlineEmphasis}</span></h1><p className="mt-6 max-w-[700px] text-base leading-7 text-[#66716b]">{report.summary}</p></div><div className={`rounded-[1.4rem] border border-[#287c60]/15 p-6 ${toneClass}`}><span className="text-[9px] font-semibold uppercase tracking-[.14em] text-[#487261]">How AI affected your ideas</span><strong className="mt-3 block text-2xl font-medium tracking-[-.04em]">{verdictPresentation.label}</strong><span className="mt-3 inline-block rounded-full bg-white/55 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.1em] text-[#65746d]">Tentative reading · one conversation</span><p className="mt-3 text-[11px] leading-5 text-[#587067]">This is our best guess from this one conversation. It cannot prove that AI caused the change.</p></div></header>

      <section className="mt-12 overflow-hidden rounded-[2rem] border border-[#17211d]/[.07] bg-white/65"><div className="grid lg:grid-cols-[.72fr_1.28fr]"><div className={`p-7 sm:p-9 ${toneClass}`}><p className="eyebrow text-[#477361]">What AI changed</p><h2 className="mt-5 text-3xl font-medium tracking-[-.045em]">{report.aiEffectHeadline}</h2><p className="mt-4 text-sm leading-6 text-[#5a6d65]">{report.aiEffectExplanation}</p><button onClick={onResearch} className="mt-7 text-xs font-semibold text-[#216b51]">See why we said this →</button></div><div className={`grid divide-y divide-[#17211d]/[.07] sm:divide-x sm:divide-y-0 ${report.aiEffectSignals.length === 1 ? "sm:grid-cols-1" : report.aiEffectSignals.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>{report.aiEffectSignals.map((signal, i) => <button onClick={() => setEvidence(signal.evidenceTurnIds)} className="p-7 text-left sm:p-8" key={`${signal.title}-${i}`}><span className={`inline-block rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.1em] ${signal.direction === "boost" ? "bg-[#dcece3] text-[#267054]" : signal.direction === "drag" ? "bg-[#eee2e1] text-[#875853]" : "bg-[#e7e9e5] text-[#65706a]"}`}>{signal.direction === "boost" ? "Possible help here" : signal.direction === "drag" ? "AI may have limited you here" : "The change is unclear"}</span><h3 className="mt-8 text-sm font-semibold">{signal.title}</h3><p className="mt-3 text-sm leading-6 text-[#68736d]">{signal.explanation}</p><span className="mt-6 block text-[9px] font-semibold uppercase tracking-[.1em] text-[#39745e]">See the exact moment →</span></button>)}</div></div></section>

      <section className="mt-14"><div className="max-w-[650px]"><p className="eyebrow">What you did with ideas</p><h2 className="mt-4 text-3xl font-medium tracking-[-.045em]">Ideas you put into words.</h2><p className="mt-3 text-sm leading-6 text-[#6a756f]">This is about this conversation only. It is not a label for you.</p></div><div className="mt-7 grid gap-5 lg:grid-cols-3">{report.takeaways.map((takeaway, i) => <button onClick={() => setEvidence(takeaway.evidenceTurnIds)} key={`${takeaway.title}-${i}`} className={`min-h-[255px] rounded-[1.7rem] p-7 text-left transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(23,33,29,.08)] ${i === 0 ? "bg-[#d8eadf]" : i === 1 ? "bg-[#e9e4d3]" : "bg-[#dfe3ed]"}`}><span className="text-[10px] text-[#77827c]">0{i + 1}</span><h3 className="mt-10 text-xl font-medium leading-7 tracking-[-.025em]">{takeaway.title}</h3><p className="mt-4 text-sm leading-6 text-[#5f6b65]">{takeaway.explanation}</p><span className="mt-7 block text-[10px] font-semibold uppercase tracking-[.1em] text-[#39745e]">See where this happened →</span></button>)}</div></section>

      <section className="mt-14 rounded-[2rem] border border-[#17211d]/[.07] bg-[#eef1eb] p-7 sm:p-10"><div className="max-w-[760px]"><p className="eyebrow">How to use AI next time</p><h2 className="mt-4 text-4xl font-medium tracking-[-.05em]">Things to try next time.</h2><p className="mt-4 text-sm leading-6 text-[#68736d]">These suggestions use moments from your conversation. They are things to try, not proven ways to improve creativity.</p></div><div className="mt-8 grid gap-5 lg:grid-cols-3">{report.coachingPlan.map((item, index) => <article className="flex min-h-[390px] flex-col rounded-[1.6rem] border border-[#17211d]/[.07] bg-white/75 p-6" key={`${item.title}-${index}`}><span className="text-[9px] font-semibold uppercase tracking-[.12em] text-[#298060]">Tip {index + 1}</span><h3 className="mt-6 text-xl font-medium leading-7 tracking-[-.03em]">{item.title}</h3><p className="mt-4 text-sm leading-6 text-[#59665f]">{item.action}</p><div className="mt-5 rounded-xl bg-[#17211d] p-4 text-white"><span className="text-[8px] font-semibold uppercase tracking-[.12em] text-white/40">Ask AI this</span><p className="mt-2 text-xs leading-5 text-white/75">“{item.tryPrompt}”</p><button onClick={() => copyPrompt(item.tryPrompt, index)} className="mt-4 text-[9px] font-semibold uppercase tracking-[.1em] text-[#7ed3b0]">{copiedPrompt === index ? "Copied ✓" : "Copy question"}</button></div><div className="mt-auto pt-5"><p className="text-[10px] leading-4 text-[#7b8580]"><strong className="text-[#59665f]">Why this may help you:</strong> {item.whyThisFits}</p><button onClick={() => setEvidence(item.evidenceTurnIds)} className="mt-4 text-[9px] font-semibold uppercase tracking-[.1em] text-[#39745e]">See where this happened →</button></div></article>)}</div></section>

      <section className="panel mt-5 p-7 sm:p-9"><div className="flex items-start justify-between gap-6"><div><p className="eyebrow">How your ideas changed</p><h2 className="mt-3 text-2xl font-medium tracking-[-.04em]">Your path through the conversation.</h2><p className="mt-3 max-w-[570px] text-xs leading-5 text-[#75807a]">Left to right follows idea order. Higher dots have a larger minimum embedding distance from earlier ideas. This depends on the model and does not measure creativity. The first idea has no earlier comparison.</p></div><div className="legend"><span><i className="human-dot" /> You</span><span><i className="ai-dot" /> AI</span></div></div>{analysis.quality.status === "incomplete_analysis" ? <p className="mt-6 text-sm text-[#68736d]">The idea map is unavailable until the incomplete analysis is resolved.</p> : <SemanticMap analysis={analysis} onSelect={setEvidence} />}</section>

      <section className="mt-5 rounded-[2rem] bg-[#17211d] p-7 text-white sm:p-10"><div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]"><div><p className="eyebrow text-white/45">In one sentence</p><h2 className="mt-4 max-w-[780px] text-3xl font-medium tracking-[-.045em]">{report.bottomLine}</h2><p className="mt-3 max-w-[760px] text-sm leading-6 text-white/55">{report.bottomLineCaveat}</p></div><button onClick={onResearch} className="rounded-full bg-white px-6 py-3 text-sm font-medium text-[#17211d]">See how this was calculated</button></div></section>
      <p className="disclaimer mx-auto mt-8 max-w-[900px] text-center">This report looks only at the words in this one conversation. It cannot measure your brain, intelligence, personality, or overall creativity. The research view shows the detailed math, the exact conversation moments used, and what we are unsure about.</p>
    </div>
    {evidence && <EvidenceDialog messages={evidenceMessages(transcript, evidence)} onClose={() => setEvidence(null)} />}
  </main>;
}

function SemanticMap({ analysis, onSelect }: { analysis: AnalysisResult; onSelect: (ids: number[]) => void }) {
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
    <span className="absolute bottom-3 right-4 text-[10px] text-[#6f7a75]">Lines follow displayed idea order; they are not parent links.</span>
    {links.map(link => <span key={link.id} className="semantic-link" style={{ left: link.x, top: link.y, width: link.length, transform: `rotate(${link.angle}deg)` }} />)}
    {nodes.map((idea, index) => { const point = pointById.get(idea.id); return <span ref={element => { nodeRefs.current[idea.id] = element; }} key={idea.id} className="semantic-node-anchor" style={{ left: `${point?.x ?? 50}%`, top: `${point?.y ?? 50}%` }}><button onClick={() => onSelect(idea.evidenceTurnIds)} className={`map-node ${idea.source === "ai" ? "ai-map" : idea.source === "co-created" ? "cocreated-map" : ""}`} aria-label={`Step ${index + 1}: ${idea.label}, ${idea.source} idea`}><small>{String(index + 1).padStart(2, "0")}</small><b>{idea.source === "ai" ? "AI" : idea.source === "co-created" ? "H+AI" : idea.source === "uncertain" ? "?" : "H"}</b><span>{idea.label}</span></button></span>; })}
  </div>;
}

function Research({ analysis, transcript, onBack }: { analysis: AnalysisResult; transcript: Message[]; onBack: () => void }) {
  const [tab, setTab] = useState<"metrics" | "genealogy" | "transcript">("metrics");
  const initialMetric = analysis.metricGroups[0]?.metrics[0];
  const [selected, setSelected] = useState<number[]>(initialMetric?.evidenceTurnIds ?? []);
  const [selectedMetricKey, setSelectedMetricKey] = useState(initialMetric?.key ?? "");

  const selectedMetric = analysis.metricGroups.flatMap(group => group.metrics).find(item => item.key === selectedMetricKey);

  const selectMetric = (item: Metric) => { setSelectedMetricKey(item.key); setSelected(item.evidenceTurnIds); };
  return <main className="min-h-screen bg-[#eef1ec] text-[#17211d]"><header className="border-b border-[#17211d]/[.08] bg-[#f6f7f3]"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8"><div className="flex items-center gap-5"><Logo /><span className="hidden h-5 w-px bg-[#17211d]/10 sm:block" /><span className="hidden text-xs text-[#6f7974] sm:block">Session 01 · {analysis.session.turnCount} turns · Conversation-derived</span></div><button onClick={onBack} className="soft-button">← Personal report</button></div></header>
    <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"><section className="flex flex-col justify-between gap-6 border-b border-[#17211d]/10 pb-7 lg:flex-row lg:items-end"><div><p className="eyebrow">Research dashboard</p><h1 className="mt-3 text-4xl font-medium tracking-[-.055em]">Creative process observatory</h1><p className="mt-3 max-w-[730px] text-sm leading-6 text-[#69736e]">Time-resolved, evidence-linked descriptors calculated from this human–AI interaction. Every value includes an uncertainty label and should be treated as exploratory.</p></div><div className="flex flex-wrap gap-2"><span className="data-pill">{analysis.session.atomicIdeaCount} atomic ideas</span><span className="data-pill">{analysis.session.turnCount} turns</span><span className="data-pill">{analysis.session.evidenceLinkedPercent}% evidence linked</span></div></section>
      <AnalysisStatus analysis={analysis} /><nav className="mt-6 flex gap-1 rounded-xl bg-[#dfe4de] p-1 sm:w-fit">{[["metrics","Metric matrix"],["genealogy","Idea genealogy"],["transcript","Annotated transcript"]].map(([id,label]) => <button onClick={() => setTab(id as typeof tab)} className={`dashboard-tab ${tab === id ? "active" : ""}`} key={id}>{label}</button>)}</nav>
      {tab === "metrics" && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5">{analysis.metricGroups.map(group => <section className="research-panel" key={group.title}><header><div><h2>{group.title}</h2><p>{group.description}</p></div><span>{group.metrics.length} measures</span></header><div className="metric-table">{group.metrics.map(item => <button onClick={() => selectMetric(item)} className="metric-row" key={item.key}><span className="metric-name">{item.name}</span><strong>{item.displayValue}</strong><span className="metric-note">{item.note}</span><span className="confidence low">{item.method} · {item.supportingTurnCount} turns</span><i>→</i></button>)}</div></section>)}</div><EvidencePanel messages={evidenceMessages(transcript, selected)} analysis={analysis} metric={selectedMetric} /></div>}
      {tab === "genealogy" && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="research-panel min-h-[650px]"><header><div><h2>Atomic idea genealogy</h2><p>Parent–child inferences across human and AI contributions</p></div><div className="legend"><span><i className="human-dot" /> Human</span><span><i className="ai-dot" /> AI</span></div></header><Genealogy ideas={analysis.atomicIdeas} onSelect={ids => { setSelected(ids); setSelectedMetricKey(""); }} /></section><EvidencePanel messages={evidenceMessages(transcript, selected)} analysis={analysis} /></div>}
      {tab === "transcript" && <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="research-panel"><header><div><h2>Evidence-linked transcript</h2><p>Click an annotated turn to inspect ideas and uncalibrated model interpretations</p></div><span>{analysis.session.turnCount} turns</span></header><div className="p-5 sm:p-7">{transcript.map(message => { const item = analysis.transcriptAnnotations.find(candidate => candidate.turnId === message.id); return <button key={message.id} onClick={() => { setSelected([message.id]); setSelectedMetricKey(""); }} className={`transcript-row ${selected.includes(message.id) ? "selected" : ""}`}><span className={`speaker-token ${message.role}`}>{message.role === "human" ? "H" : "AI"}</span><div><div className="flex flex-wrap items-center gap-2"><strong>{message.role === "human" ? "Participant" : "Locus guide"}</strong><small>{message.phase}</small></div><p>{message.text}</p>{item && <span className="annotation-chip">{item.summary}</span>}</div><i>{String(message.id).padStart(2, "0")}</i></button>; })}</div></section><EvidencePanel messages={evidenceMessages(transcript, selected)} analysis={analysis} /></div>}
      <section className="mt-5 rounded-2xl border border-[#9d7b42]/20 bg-[#f4eddf] p-5 text-xs leading-5 text-[#75633f]"><strong>Interpretation boundary.</strong> These values were calculated from this conversation using model-based extraction and classification plus {analysis.embeddingModel} embedding comparisons. They are not validated psychological or neuroscience measures and should not be used for diagnosis, selection, ranking, or claims about stable ability.</section>
    </div>
  </main>;
}

function AnalysisStatus({ analysis, onRetry }: { analysis: AnalysisResult; onRetry?: () => void }) {
  const quality = analysis.quality;
  return <section className="my-5 rounded-2xl border border-[#9d7b42]/20 bg-[#f4eddf] p-5 text-xs leading-5 text-[#75633f]" aria-label="Analysis status">
    <strong>{quality.status === "incomplete_analysis" ? "Analysis incomplete" : quality.protocolComplete ? "Conversation completed" : "Conversation ended early"}</strong>
    <p>{quality.status === "incomplete_analysis" && quality.protocolComplete ? "You completed the conversation. " : ""}{quality.coverage.filter(c => c.status !== "failed").length} of {quality.coverage.length} turns checked. {quality.status === "insufficient_material" ? "All parts were answered, but there is too little usable material for a fair comparison." : quality.status === "incomplete_analysis" ? "Some extraction or relationships could not be validated. Affected values are withheld." : "Results describe this conversation only."}</p>
    {quality.baselineContaminated && <p>An AI idea appeared during opening questions. The baseline comparison is withheld.</p>}
    {quality.diagnostics.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Analysis details</summary><ul className="mt-2 list-disc pl-5">{quality.diagnostics.map((d, i) => <li key={i}>{d.turnId ? `Turn ${d.turnId}: ` : ""}{d.message}</li>)}</ul></details>}
    {quality.status === "incomplete_analysis" && onRetry && <button onClick={onRetry} className="mt-3 underline">Retry incomplete analysis</button>}
  </section>;
}

function EvidenceDialog({ messages, onClose }: { messages: Message[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onClose={onClose} aria-label="Conversation moments" className="m-auto max-h-[85dvh] w-[min(92vw,720px)] overflow-y-auto rounded-3xl border-0 bg-[#17211d] p-7 text-white backdrop:bg-black/45">
    <div className="flex items-center justify-between gap-5"><h2 className="text-xl">Conversation moments</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label="Close conversation moments" className="rounded-full px-3 py-2">Close ×</button></div>
    {messages.length ? messages.map(message => <article key={message.id} className="mt-5 border-t border-white/15 pt-5"><strong className="text-xs text-[#8dd4b8]">{message.role === "human" ? "You" : "AI guide"} · Turn {message.id}</strong><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.text}</p></article>) : <p className="mt-5 text-sm">No checked conversation moment is available for this claim.</p>}
  </dialog>;
}

function EvidencePanel({ messages, analysis, metric }: { messages: Message[]; analysis: AnalysisResult; metric?: Metric }) {
  return <aside aria-label="Evidence inspector" className="sticky top-6 max-h-[85dvh] overflow-y-auto rounded-[1.4rem] border border-[#17211d]/[.08] bg-[#17211d] p-6 text-white">
    <p className="eyebrow text-white/40">Evidence inspector</p>
    {metric && <div className="mt-6 rounded-xl bg-white/[.06] p-4"><strong className="text-xs">{metric.name}</strong><p className="mt-2 text-xs leading-5">{metric.interpretation}</p><p className="mt-3 text-xs text-white/60">{metric.method} · Speaker scope: {metric.speakerScope} · {metric.supportingTurnCount} supporting turns</p><p className="mt-3 text-xs text-white/60">Uncertainty: {metric.uncertainty}</p></div>}
    {messages.map(message => { const annotation = analysis.transcriptAnnotations.find(a => a.turnId === message.id); return <article key={message.id} className="mt-6 border-t border-white/15 pt-5"><strong className="text-xs">{message.role === "human" ? "Participant" : "AI guide"} · Turn {message.id} · {message.phase}</strong><blockquote className="mt-3 text-sm leading-6">“{message.text}”</blockquote>{annotation && <div className="mt-4 rounded-xl bg-white/[.06] p-4 text-xs leading-5"><p>{annotation.summary}</p><p className="mt-2 text-[#8dd4b8]">{annotation.operations.join(" · ")}</p><p className="mt-2 text-white/50">Model self-rating: {annotation.confidence} (uncalibrated)</p></div>}</article>; })}
    {!messages.length && <p className="mt-5 text-sm text-white/60">No checked evidence is available for this item.</p>}
    <p className="mt-6 text-xs leading-5 text-white/60">Supporting turns describe evidence quantity, not statistical confidence. Multiple ideas from one answer are not independent trials. Model interpretations and self-ratings are uncalibrated.</p>
  </aside>;
}

function Genealogy({ ideas, onSelect }: { ideas: AtomicIdea[]; onSelect: (ids: number[]) => void }) { const byId = new Map(ideas.map(idea => [idea.id, idea])); return <div className="genealogy-grid">{ideas.map((idea, index) => <button onClick={() => onSelect(idea.evidenceTurnIds)} key={idea.id} className={`genealogy-card ${idea.source}`}><div className="flex items-center justify-between"><small>{idea.source === "human" ? "Human" : idea.source === "ai" ? "AI" : idea.source === "co-created" ? "Co-created" : "Uncertain origin"}</small><span>{String(index + 1).padStart(2, "0")}</span></div><strong>{idea.label}</strong><p>{idea.summary}</p><div className="mt-4 border-t border-[#17211d]/[.07] pt-3"><span>Turn {String(idea.turnId).padStart(2, "0")} · {idea.phase} · {idea.lineageStatus}</span>{idea.parentIds.length > 0 && <em>Built from: {idea.parentIds.map(parentId => byId.get(parentId)?.label ?? parentId).join(", ")}</em>}</div></button>)}</div>; }

export default function Home() {
  const [stage, setStage] = useState<Stage>("intro");
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [cache] = useState(() => new SessionAnalysisCache());
  const sessionGeneration = useRef(0);
  useEffect(() => () => cache.clear(), [cache]);
  const restart = () => { sessionGeneration.current++; cache.clear(); setTranscript([]); setAnalysis(null); setStage("intro"); };
  const generation = sessionGeneration.current;
  if (stage === "intro") return <Intro onStart={() => setStage("session")} />;
  if (stage === "session") return <Session onFinish={messages => { setTranscript(messages); setStage("analyzing"); }} />;
  if (stage === "analyzing") return <Analyzing messages={transcript} cache={cache} onDone={result => { if (sessionGeneration.current !== generation) return; setAnalysis(result); setStage("report"); }} onRestart={restart} />;
  if (stage === "report" && analysis) return <Report analysis={analysis} transcript={transcript} onResearch={() => setStage("research")} onRestart={restart} onRetry={() => { cache.clear(); setAnalysis(null); setStage("analyzing"); }} />;
  if (stage === "research" && analysis) return <Research analysis={analysis} transcript={transcript} onBack={() => setStage("report")} />;
  return <Intro onStart={() => setStage("session")} />;
}
