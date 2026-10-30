import { describe, expect, it, vi } from "vitest";
import { SessionAnalysisCache } from "../lib/session-analysis";
import { courtroom } from "./fixtures";

describe("session memory and cancellation", () => {
  it("deduplicates one active transcript and clears the result on restart", async () => {
    const fetcher = vi.fn(async () => Response.json({ marker: "first" }));
    const cache = new SessionAnalysisCache(fetcher);
    const first = cache.request(courtroom);
    expect(cache.request(courtroom)).toBe(first);
    await first;
    expect(cache.request(courtroom)).toBe(first);
    cache.clear();
    await cache.request(courtroom);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("aborts pending work and rejects a late old-session response even if transport ignores abort", async () => {
    let resolve!: (response: Response) => void;
    let signal: AbortSignal | null | undefined;
    const cache = new SessionAnalysisCache(vi.fn((_url, init) => { signal = init?.signal; return new Promise<Response>(done => { resolve = done; }); }));
    const old = cache.request(courtroom);
    const rejection = expect(old).rejects.toMatchObject({ name: "AbortError" });
    cache.clear();
    expect(signal?.aborted).toBe(true);
    resolve(Response.json({ old: true }));
    await rejection;
  });
  it("can retry a failed analysis", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "Analysis failed." }, { status: 502 })).mockResolvedValueOnce(Response.json({ success: true }));
    const cache = new SessionAnalysisCache(fetcher);
    await expect(cache.request(courtroom)).rejects.toThrow("Analysis failed.");
    await cache.request(courtroom);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
