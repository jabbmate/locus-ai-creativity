import { expect, test, type Page } from "@playwright/test";
import { analyzeTranscript } from "../../lib/analysis-pipeline";
import { courtroom, fakeProvider } from "../fixtures";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin your session" }).click();
  await expect(page.getByText("Your text and response timing are processed", { exact: false })).toBeVisible();
}
async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Your response" }).fill(text);
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByRole("button", { name: "Complete session" })).toBeEnabled();
}

test("full session, multi-turn evidence, research panel, and restart", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const phases = ["Baseline", "Creative cue", "Co-creation", "Co-creation", "Co-creation", "Independent", "Reflection"];
  let chats = 0;
  const guideReplies = ["What else could you try?", "Choose an unrelated place.", courtroom[4].text, courtroom[6].text, "How would it work?", "What would you try yourself?", "What felt like yours?"];
  await page.route("**/api/chat", async route => { expect(route.request().postDataJSON().phase).toBe(phases[chats]); await route.fulfill({ json: { text: guideReplies[chats++] } }); });
  await page.route("**/api/analyze", async route => route.fulfill({ json: await analyzeTranscript(route.request().postDataJSON().messages, fakeProvider()) }));
  await start(page);
  const answers = [courtroom[1].text, "Add magnetic shapes.", courtroom[3].text, courtroom[5].text, courtroom[7].text, "People can choose which puzzle to join.", courtroom[9].text, courtroom[11].text];
  for (let i = 0; i < answers.length; i++) {
    await page.getByRole("textbox", { name: "Your response" }).fill(answers[i]);
    await page.getByRole("button", { name: "Send response" }).click();
    if (i < 7) await expect(page.getByRole("button", { name: "Complete session" })).toBeEnabled();
  }
  await expect(page.getByRole("heading", { name: "Here is what happened to your ideas." })).toBeVisible();
  await expect(page.getByLabel("Analysis status")).toContainText("Conversation completed");
  await page.screenshot({ path: "test-results/personal-report.png", fullPage: true });
  await page.getByRole("button", { name: /You pushed back on AI/ }).click();
  const dialog = page.getByRole("dialog", { name: "Conversation moments" });
  await expect(dialog).toContainText("AI guide · Turn 9"); await expect(dialog).toContainText("You · Turn 10");
  await expect(dialog).toContainText("No, I reject everyone agreeing.");
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "See research details" }).click();
  await page.getByRole("button", { name: /Closeness to direct AI parents/ }).click();
  const inspector = page.getByLabel("Evidence inspector");
  await expect(inspector).toContainText("AI guide · Turn 7"); await expect(inspector).toContainText("Participant · Turn 8");
  await expect(inspector).toContainText("not statistical confidence");
  await page.getByRole("button", { name: "Personal report" }).click();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Begin your session" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("early completion, analysis failure and retry, then restart rejects a late response", async ({ page }) => {
  const early = await analyzeTranscript(courtroom.slice(0, 2), fakeProvider());
  let calls = 0;
  await page.route("**/api/chat", route => route.fulfill({ json: { text: "What else could you try?" } }));
  await page.route("**/api/analyze", async route => { calls++; return calls === 1 ? route.fulfill({ status: 502, json: { error: "Synthetic extraction failure" } }) : route.fulfill({ json: await analyzeTranscript(route.request().postDataJSON().messages, fakeProvider()) }); });
  await start(page); await send(page, "A shared jigsaw puzzle");
  await page.getByRole("button", { name: "Complete session" }).click();
  await expect(page.getByText("We couldn’t finish the analysis.")).toBeVisible();
  await page.getByRole("button", { name: "Try analysis again" }).click();
  await expect(page.getByLabel("Analysis status")).toContainText("Conversation ended early");
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await page.unroute("**/api/analyze");
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/analyze", async route => { await waiting; await route.fulfill({ json: early }).catch(() => {}); });
  await page.getByRole("button", { name: "Begin your session" }).click(); await send(page, "A different idea");
  await page.getByRole("button", { name: "Complete session" }).click();
  await page.getByRole("button", { name: "Start new session", exact: true }).click();
  release();
  await expect(page.getByRole("button", { name: "Begin your session" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Here is what happened to your ideas." })).not.toBeVisible();
});

test("completed session with extraction gaps offers retry, not a false early-exit message", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/chat", route => route.fulfill({ json: { text: "What else?" } }));
  await page.route("**/api/analyze", async route => route.fulfill({ json: await analyzeTranscript(route.request().postDataJSON().messages, ++calls === 1 ? fakeProvider({ async extract() { throw new Error("Synthetic failure"); } }) : fakeProvider()) }));
  await start(page);
  for (let i = 0; i < 8; i++) {
    await page.getByRole("textbox", { name: "Your response" }).fill(`My idea ${i + 1} is a shared puzzle`);
    await page.getByRole("button", { name: "Send response" }).click();
    if (i < 7) await expect(page.getByRole("button", { name: "Complete session" })).toBeEnabled();
  }
  await expect(page.getByLabel("Analysis status")).toContainText("Analysis incomplete");
  await expect(page.getByLabel("Analysis status")).not.toContainText("ended early");
  await page.getByRole("button", { name: "Retry incomplete analysis" }).click();
  await expect(page.getByLabel("Analysis status")).toContainText("Conversation completed");
});

test("mobile keyboard user can read privacy before typing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const privacy = page.getByRole("link", { name: "Privacy and retention" });
  await privacy.focus(); await expect(privacy).toBeFocused(); await expect(privacy).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Your conversation and privacy" })).toBeVisible();
  await expect(page.getByText("AI and hosting providers may retain", { exact: false })).toBeVisible();
});
