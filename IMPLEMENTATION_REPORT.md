# Locus correctness and transparency review

Implemented locally on October 30, 2026. These are software and presentation fixes for an exploratory prototype. They do not validate Locus as a creativity assessment.

The local review was completed before publication. Unit, integration, and browser verification used synthetic or mocked provider responses; no paid provider-backed tests were performed. Release status and deployment details are recorded in GitHub and Vercel.

## Behavior before and after

| Area | Previous behavior / evidence | Current behavior |
| --- | --- | --- |
| Human challenge rate | Confirmed in code: challenge annotations from either speaker were divided by human turns. Duplicate annotations were not deduplicated. | Resolves annotations to transcript speakers and counts unique human turns only. Uses the same filtered turns as evidence. AI-only challenge = 0 of 1; one human challenge in two human turns = 50%; zero human turns = insufficient data. Construction prevents rates over 100%. |
| Other operations | Synthesis and reframing counts included either speaker without explicit scope. | Both are explicitly human-turn counts. Other metrics carry a human, AI, or both-speaker scope. Human evaluation evidence is filtered to humans; collaboration judgments require both roles. |
| Personal-report attribution | The previous model generated an ownership story independently of the extracted records. The notes reported the courtroom-domain / human-evidence-rule error. | Ownership prose is assembled from transcript-owned quotes and checked relationships. The AI's broad-domain suggestion and the human's specific rule are shown separately. Shared and uncertain origins are retained. Exact quote checks verify words and speaker, not the semantic correctness of the model's interpretation or original authorship. |
| Evidence navigation | Confirmed in UI: personal cards and research metric selection used only the first linked ID. | Personal cards open a keyboard-accessible dialog with every linked message in transcript order and speaker labels. Research metrics and genealogy show all their supporting turns. Rejection cards include the actual human rejection and AI suggestion. |
| Late ideas | Confirmed schema limit: 30 ideas for the entire conversation. The notes reported omission of independent-stage ideas, but the cap's causal role was not established. | Extracts every turn separately with explicit coverage status. Each turn gets 12 slots and one retry with 24 if capped, incomplete, invalid, or failed. This prevents early turns from exhausting one session-wide allowance. Review must account for every extracted idea, including late turns. |
| Completion vs extraction | The old inconclusive fallback inferred an early exit from missing extracted ideas. | Protocol completion comes from human responses in the five transcript phases. Statuses distinguish early exit, incomplete analysis, completed conversation with insufficient usable material, and completed analysis. A completed conversation with extraction gaps is explicitly described as completed but incompletely analyzed, with retry available. Affected metrics and the map are withheld. |
| Genealogy | Confirmed in code: allowed parents depended on output-array order, and invalid links were silently removed. This could create false roots. | Transcript order and phase metadata are authoritative. Checks unique IDs, missing records, exact quote support, unknown references, mismatched phases/turns, wrong-speaker origin, missing parent evidence, duplicate parents, self-links, future links, and cycles. Same-turn parentage is disallowed. Invalid ancestry is marked unresolved and propagates to descendants; it never silently creates a valid root. |
| Confidence | Calculated rows used observation-count thresholds; the evidence panel claimed method agreement. | Shows distinct supporting-turn counts and method instead. Multiple ideas in one answer are not independent trials. Annotation self-ratings are explicitly uncalibrated. No method-agreement or statistical reliability claim remains. |
| Scientific labels | Phase measures were called creativity scores; AI amplification was shown as a percentage. | Phase measures are named embedding novelty. AI-development and evaluation ratings are labeled model judgments on an uncalibrated 0–1 rubric. Model counts are also labeled as judgments. None is a percent change in creativity. |
| Map | Prose described novelty, while coordinates used a principal-component projection. | Vertical position now actually represents minimum cosine distance to earlier extracted ideas. The first idea has no prior comparison and is placed at the bottom by convention. Horizontal positions follow idea order. Sampled connecting lines describe sequence, not genealogy. |
| Landing example | Fixed numbers appeared under “Live idea trace.” | Clearly labeled “Example idea trace,” “Illustrative example,” and “Example values, not a live session or measured results.” |
| Baseline | “Before AI concepts” overstated the condition; prompts could introduce seeds. | Defined as a task-assisted, question-only baseline. The guide is instructed to avoid new domains, objects, analogies, and solutions. The cue asks participants to choose their own domain. If extracted AI concepts precede a later baseline answer, baseline novelty is withheld and contamination is disclosed. Detection still depends on extraction. |
| Privacy | No visible pre-submission processing and retention notice. | Composer notice before typing/submitting, accessible privacy link, and fuller `/privacy` page. Explains text, timing, live requests, final analysis, embeddings, app memory, provider/host retention uncertainty, and avoiding identifying information. Does not promise zero provider or host retention. |
| Reset and stale requests | Confirmed module-global transcript-keyed cache survived New session. | Cache belongs to one Home instance. Restart clears session/cache data, aborts pending work, and advances a generation guard. Late old-session responses cannot become new-session results, including when a mock transport ignores abort. Active-session request deduplication is retained. |
| API errors | Provider errors could be unhandled or logged with raw message contents. | Validates chat and analysis payloads, handles malformed JSON, bounds provider time/retries, sets no-store responses, and returns generic errors. Logs omit transcript text and raw provider errors. |

## Interpretation safeguards

The personal report uses checked quotes and tentative language. A recorded development or combination may support a possible useful connection; a model-flagged limiting effect is shown alongside it rather than hidden. Rejection alone does not establish harm. An incomplete, contaminated, or inadequately populated comparison cannot receive a positive verdict. A completed analysis can still find no clear change.

Tips are presented as things to try, not proven treatments or guaranteed improvements. The app observes written output, not literal brain function or the participant's unspoken ideas.

## Changed files

- `app/api/analyze/route.ts`: validated request boundary, injected pipeline, cancellation, time budget, generic errors and no-store.
- `lib/analysis-schemas.ts`: request, per-turn extraction, relationship, and judgment schemas.
- `lib/analysis-pipeline.ts`: bounded per-turn extraction, coverage ledger, relationship review, validation, embeddings, and result assembly.
- `lib/analysis-provider.ts`: actual provider adapter; SDK APIs verified against the installed package documentation and types.
- `lib/analysis-validation.ts`: transcript-authoritative genealogy, evidence ordering, speaker scope, quality assessment, and judgment checks.
- `lib/analysis-metrics.ts`: mathematical calculations, scoped operations, model-rating labels, supporting-turn counts, and honest map coordinates.
- `lib/personal-report.ts`: checked-quote narratives and tentative interpretations with all supporting IDs.
- `lib/analysis.ts`: explicit source uncertainty, validation status, coverage, diagnostics, and metric metadata.
- `lib/session-analysis.ts`: session-owned request deduplication, abort and stale-response guards.
- `app/api/chat/route.ts`: validated inputs, question-only baseline instructions, timeouts and generic errors.
- `app/page.tsx`: all-turn evidence, completion/error states, retry/reset wiring, privacy notice, example labels, accurate map explanation, and judgment presentation.
- `app/privacy/page.tsx`: full processing and retention information.
- `tests/analysis.test.ts`, `tests/api.test.ts`, `tests/session-analysis.test.ts`, `tests/fixtures.ts`: synthetic unit, pipeline, API and lifecycle regression tests.
- `tests/browser/report.spec.ts`, `playwright.config.ts`, `vitest.config.ts`: mocked desktop/mobile browser coverage and test configuration.
- `README.md`: actual pipeline, formulas, speaker scopes, limits, privacy lifecycle, tests, and scientific caveats.
- `package.json`, `package-lock.json`, `.gitignore`: test tools/scripts, patched dependencies, and ignored test artifacts.

## Verification

Run with Node 22.16.0:

| Check | Result |
| --- | --- |
| `npm test` | 34 unit/integration tests passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed, Next.js 16.4.3; includes `/privacy` |
| `npm run test:e2e` | 4 browser tests passed |
| `git diff --check` | Passed |
| Dependency audit | Zero reported vulnerabilities after compatible updates |

Browser scenarios cover a full eight-response session, actual request phase order, early completion, failure and retry, a completed session with extraction failure, incomplete-analysis retry, all-turn evidence navigation, restart with a late response, and privacy access on a narrow screen with keyboard focus. The report screenshot was inspected. The full-session browser test also checks for uncaught page errors.

All test conversations and provider/embedding responses are synthetic or mocked. Browser tests intercept the API and use a local server with an empty provider key. Actual provider semantic accuracy, latency, cost, and reliability were **not** tested. Per-turn extraction makes more requests than the old single-call pipeline; its total request deadline remains bounded.

The audit also found existing dependency advisories. Next.js and Zod plus affected compatible dependencies were updated, and an unused direct `react-server-dom-webpack` development dependency was removed. The application build and regression suite pass with those changes.

## Unresolved hypotheses and remaining research limitations

- The old 30-idea cap was a plausible contributor to missing late ideas, not a proven explanation for the original provider run. This revision removes the shared cap and detects declared/incomplete output; it cannot guarantee a model never silently omits an idea.
- Quotes and speaker IDs can be checked mechanically. Idea boundaries, semantic entailment, originality, parent links, operations, co-created origins, and the meaning of a flagged limiting effect still involve uncalibrated model judgments.
- If a provider or review fails entirely, the app shows an explicit retry error; no substitute values are generated. Conservative validation can produce more incomplete results than before. That tradeoff and provider-backed success rate need evaluation before release.
- The baseline is task-assisted, questions can affect ideas, and a model may violate or misclassify question-only support. The contamination check is not a guarantee of a seed-free baseline.
- Fixed-order phases, practice, prompt changes, fatigue, self-selection, and sparse data remain confounded. There is no independent counterfactual, random assignment, or validated causal estimate of AI's effect.
- Embedding distance is model-dependent and can reflect irrelevant differences. It does not itself measure usefulness, quality, psychological creativity, or brain function.
- Provider and host retention settings were not independently audited. Cancellation does not erase requests already received by a provider.

Research validation remains separate work: blinded human coding, coder agreement, outcome-quality ratings, repeated randomized and counterbalanced controls, reliability studies, preregistration, representative samples, and suitable research/privacy governance.
