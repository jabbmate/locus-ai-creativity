import type { AnalysisResult, SessionMessage } from "./analysis";

/** Owned by one mounted Home instance. Nothing is cached across New session. */
export class SessionAnalysisCache {
  private entry?: { key: string; controller: AbortController; promise: Promise<AnalysisResult> };
  private generation = 0;
  constructor(private readonly fetcher: typeof fetch = (...args) => fetch(...args)) {}

  request(messages: SessionMessage[], force = false) {
    const key = JSON.stringify(messages);
    if (!force && this.entry?.key === key) return this.entry.promise;
    this.clear();
    const generation = this.generation;
    const controller = new AbortController();
    const promise = this.fetcher("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }), signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (generation !== this.generation) throw new DOMException("Session changed", "AbortError");
        if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
        return data as AnalysisResult;
      })
      .catch(error => { if (generation === this.generation) this.entry = undefined; throw error; });
    this.entry = { key, controller, promise };
    return promise;
  }

  clear() {
    this.generation++;
    this.entry?.controller.abort();
    this.entry = undefined;
  }
}
