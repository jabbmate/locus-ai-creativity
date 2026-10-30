import { afterEach, describe, expect, it, vi } from "vitest";
import { courtroom, fakeProvider } from "./fixtures";

vi.mock("../lib/analysis-provider", () => ({ createAnalysisProvider: vi.fn() }));
vi.mock("ai", () => ({ generateText: vi.fn() }));
import { createAnalysisProvider } from "../lib/analysis-provider";
import { generateText } from "ai";
import { POST as analyze } from "../app/api/analyze/route";
import { POST as chat } from "../app/api/chat/route";

const request = (body: unknown) => new Request("http://localhost/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
afterEach(() => vi.unstubAllEnvs());

describe("API boundary with mocked providers", () => {
  it("runs extraction, validation, embedding, metrics and grounded report without provider requests", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-not-a-key");
    vi.mocked(createAnalysisProvider).mockReturnValue(fakeProvider());
    const response = await analyze(request({ messages: courtroom }));
    const data = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(data.quality.status).toBe("complete"); expect(data.metricGroups.flatMap((g: { metrics: unknown[] }) => g.metrics)).toHaveLength(20);
    expect(data.personalReport.aiEffectSignals[0].evidenceTurnIds).toEqual([50, 60]);
  });
  it("rejects duplicate IDs, malformed JSON, and backward phases before any provider call", async () => {
    expect((await analyze(request({ messages: [courtroom[0], courtroom[0]] }))).status).toBe(400);
    expect((await analyze(new Request("http://localhost/api/analyze", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await analyze(request({ messages: [courtroom[5], courtroom[1]] }))).status).toBe(400);
  });
  it("exposes an incomplete-analysis state after bounded extraction failures", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-not-a-key");
    vi.mocked(createAnalysisProvider).mockReturnValue(fakeProvider({ async extract(m) { if (m.id === 100) throw new Error("synthetic failure"); return { substantive: false, complete: true, reason: "None.", ideas: [], operations: [], summary: "None.", confidence: "low" }; } }));
    const response = await analyze(request({ messages: courtroom }));
    expect(response.status).toBe(200); const data = await response.json();
    expect(data.quality.status).toBe("incomplete_analysis"); expect(data.quality.protocolComplete).toBe(true);
  });
  it("redacts provider failures and returns a generic retry response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-not-a-key");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createAnalysisProvider).mockReturnValue(fakeProvider({ async embed() { throw new Error("PRIVATE TRANSCRIPT or credentials"); } }));
    const response = await analyze(request({ messages: courtroom }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("PRIVATE");
    expect(log.mock.calls.flat().join(" ")).not.toContain("PRIVATE");
  });
  it("handles invalid chat input and redacts chat provider errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-not-a-key");
    expect((await chat(request({ messages: [{ role: "admin", text: "x" }], phase: "Baseline" }))).status).toBe(400);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generateText).mockRejectedValue(new Error("PRIVATE provider error"));
    const response = await chat(request({ messages: [{ role: "human", text: "A puzzle" }], phase: "Baseline" }));
    expect(response.status).toBe(502); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(log.mock.calls.flat().join(" ")).not.toContain("PRIVATE");
  });
});
