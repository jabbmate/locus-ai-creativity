# Locus

**See how your ideas move with LLMs.**

Locus is an open-source human–AI creativity experiment. It guides someone through a short creative conversation, separates the ideas contributed by the human and the model, and produces two views of the interaction:

- a plain-language personal report about how the collaboration appeared to affect the participant's thinking; and
- an evidence-linked research dashboard for inspecting idea provenance, semantic movement, creative operations, uncertainty, and the underlying transcript.

> **Try it:** [Open the live Locus experiment](https://locus-ai-creativity.vercel.app)

![Locus human brain and language-model visualization](public/locus-cognition-duet.png)

## Why I built this

I graduated from the University of Pennsylvania in May 2026 with a degree in Cognitive Science and a concentration in Computational Science. As someone who uses AI constantly, I became fascinated by a question that felt personally important: is AI extending my creativity, redirecting it, or quietly narrowing it?

I built Locus as a way to understand those ideas more concretely. Rather than assigning a single opaque “creativity score,” the project tries to reconstruct what happened during one interaction: which ideas began with the human, what the model introduced, where the human challenged or reframed the model, and what emerged only through collaboration.

Locus is an independent exploratory project. It is not affiliated with or endorsed by the University of Pennsylvania.

## The participant experience

Internally, the guided protocol moves through five analytically tagged stages:

1. **Baseline ideation** — the participant answers the shared design task with question-only AI support. This is a task-assisted baseline, not an unaided or no-AI control.
2. **Creative cue** — the participant is asked to make a less obvious connection to a domain they choose.
3. **Co-creation** — human and model extend, challenge, branch, and synthesize ideas together.
4. **Independent thinking** — the model stops supplying ideas and the participant takes the concept somewhere new.
5. **Reflection** — the participant identifies what surprised them and when the direction felt like their own.

Those labels are deliberately hidden while the participant is talking. The session interface does not show a phase name, timer, stage counter, or phase tags on messages, and the guide is instructed never to announce when a condition changes. It transitions through playful questions, unusual analogies, challenges, reversals, and synthesis prompts as one natural conversation. This reduces an obvious source of demand effects while preserving the hidden metadata needed for post-session comparison; it does not eliminate demand characteristics altogether.

There is no countdown. A participant can think at their own pace and finish once they have provided at least one response. A complete guided run collects the final reflection before beginning analysis.

### What the participant gets back

The personal report uses clear language and concrete examples from the conversation. Research terms stay in the scientist dashboard, where their definitions, uncertainty, and evidence can be inspected.

It is designed to answer two practical questions:

1. **What did AI appear to do in this session?** The report shows exact, speaker-checked quotes: what AI offered and what the person said afterward. It can describe a possible useful connection, no clear change, or insufficient information. A rejection is not automatically interpreted as harm, and a parent link is not proof of influence.
2. **How should I use AI next time?** The report offers practical things to try, with copyable questions and links to relevant moments. Suggestions are exploratory, not proven interventions.

Personal-report attribution text is assembled from validated records, rather than generated as a free-form ownership story. A broad AI suggestion such as “courtroom” is displayed separately from a later human rule such as “every claim needs evidence.” Shared and uncertain origins remain visible. This guards speaker attribution; it cannot independently establish who first imagined an idea or whether a model interpretation is correct.

The verdict describes the pattern observed inside one exchange. It does not establish whether AI generally makes that person more or less creative. That stronger claim would require repeated, randomized, counterbalanced comparisons against matched no-AI and active-control conditions.

## What the analysis measures

Every completed session is analyzed from its actual transcript. The report does not substitute a canned sample if analysis fails.

### Idea structure and agency

- atomic idea extraction
- human, AI, or co-created provenance
- idea genealogy and parent relationships
- human and AI branch creation
- human initiation
- AI amplification
- a preliminary evidence-of-boost / mixed / no-change / constraint verdict
- challenge rate
- synthesis and reframing
- possible AI preemption
- co-creative emergence

### Movement and change

- semantic trajectory across the conversation
- mean semantic distance between consecutive ideas
- conceptual diversity across human ideas
- lexical diversity in human responses
- baseline, cued, and post-AI novelty
- AI creative pull
- divergence recovery after the model steps back
- generative fluency and evaluative depth
- response-time metadata

Each research metric includes a display value, raw value where applicable, method (calculation or model judgment), speaker scope, number of distinct supporting turns, uncertainty statement, and links to every supporting transcript turn. Supporting-turn counts describe evidence quantity, not statistical confidence.

## How it works

```text
Guided conversation
        │
        ▼
Complete transcript + phases + response timing
        │
        ├── Structured model analysis
        │     atomic ideas, provenance, genealogy,
        │     operations, judgments, evidence links
        │
        └── Embedding analysis
              semantic distances, conceptual diversity,
              phase novelty, AI pull, idea map
        │
        ▼
Personal report + inspectable research dashboard
```

The analysis endpoint extracts each turn separately (at most four extraction requests at once), checks exact quote support, then reviews relationships and judgments against the complete transcript. Deterministic code calculates counts, ratios, timing summaries, and embedding distances. Invalid or missing relationships produce explicit diagnostics and an incomplete-analysis state; they are not silently converted into independent roots. These checks validate software structure and speaker references, not scientific validity or semantic truth.

A failed extraction gets one bounded retry with a larger per-turn allowance. If it remains incomplete, the report identifies the affected turn and withholds metrics. A failed review or embedding request shows an explicit retry screen. No example measurements are substituted. Per-turn extraction adds provider requests and latency compared with a single-pass analysis; provider-backed cost and latency have not been benchmarked for this revision.

## Inside the analysis engine

The post-conversation analysis is a hybrid pipeline. A language model handles tasks that require interpreting meaning; application code handles the mathematical comparisons. Keeping those layers separate makes it possible to see which outputs are calculated, which are judgments, and what evidence each judgment used.

```mermaid
flowchart LR
    A[Transcript turns] --> B[Per-turn extraction and quote checks]
    B --> C[Atomic ideas]
    B --> D[Turn annotations]
    C --> E[Relationship and judgment review]
    C --> F[Embedding vectors]
    F --> G[Distances and phase comparisons]
    C --> H[Provenance graph]
    D --> I[Operation counts]
    E --> J[Diagnostics, evidence quantity and uncertainty]
    G --> K[Research dashboard]
    H --> K
    I --> K
    J --> K
    K --> L[Plain-language report]
```

### 1. Transcript normalization

Every message enters the analysis with four pieces of context:

```ts
{
  id: 8,
  role: "human",
  phase: "Independent",
  text: "...",
  responseMs: 37_000
}
```

The phase comes from the guided protocol rather than model inference. Transcript array order is authoritative, even when numeric turn IDs or returned idea arrays are out of order. Turn IDs must be unique and phases must not go backward. The question-only baseline includes the shared task and guide questions. If extraction detects an AI concept during baseline before a later human baseline answer, the baseline novelty comparison is withheld. This detector itself depends on extraction and may miss a conceptual seed.

### 2. Atomic idea extraction and genealogy

The structured extractor analyzes every turn, including the final independent and reflection answers. It distinguishes substantive material from turns with no ideas, returns an exact quote for each idea, and declares whether it covered the turn completely.

Each turn starts with a 12-idea allowance. A capped, incomplete, failed, or unsupported extraction is retried once with 24. Reaching the allowance is treated conservatively as uncertain coverage, even if the model says extraction is complete. There is no session-wide 30-idea cap. A model can still omit an idea while claiming completion; the coverage ledger is not an independent completeness guarantee.

Records carry a server-assigned unique idea ID, originating turn, transcript-owned phase, label, summary, exact quote, model self-rating, source, parent links, relation type, and validation status. Sources may be human, AI, co-created, or uncertain; the speaker who expresses an idea is distinct from its inferred origin.

The relationship review uses the whole transcript. Validation checks unique IDs, missing records, unknown turns or ideas, exact quotes, phase mismatches, wrong-speaker evidence, missing parent evidence, duplicate parents, self-links, future parents, and cycles. **Same-turn parent links are disallowed** because order within a response does not establish derivation. A derived relationship with missing ancestry stays unresolved. Unresolved ancestry propagates to descendants. Such ideas remain visible in diagnostics but cannot become artificial roots.

Protocol completion is tracked from human answers in all five phases separately from extraction. The report distinguishes:

- early exit;
- incomplete analysis, including a completed conversation with extraction or genealogy gaps;
- a completed conversation with insufficient usable material or a contaminated baseline;
- completed analysis, whose AI-effect interpretation may still be uncertain.

Personal and research evidence navigation shows all linked turns in transcript order, with speaker labels. Invalid evidence is never presented as supporting a claim.

### 3. Semantic representation

For every atomic idea, Locus embeds the combined label and summary as a vector `eᵢ`. The basic semantic-distance operation is cosine distance:

```text
d(i, j) = clamp(1 − cosineSimilarity(eᵢ, eⱼ), 0, 1)
```

A value near `0` means the vectors occupy similar semantic territory in the selected embedding space. A larger value means they are farther apart. This is model-relative geometry—not a universal psychological distance.

### 4. Deterministic calculations

Once extraction and embeddings are complete, the following values are calculated in TypeScript rather than invented by the language model:

| Measure | Calculation | What it is intended to describe |
| --- | --- | --- |
| **Mean semantic distance** | Mean `d(i−1, i)` across consecutive ideas | How far the conversation moved from one extracted idea to the next |
| **Conceptual diversity** | Mean pairwise distance across all human ideas | How widely the participant's ideas spread through the embedding space |
| **Per-idea novelty** | Minimum distance from an idea to every earlier idea | How unlike the prior conversation each new idea was |
| **Baseline / cued / post-AI embedding novelty** | Mean per-idea minimum earlier distance for human-turn ideas in that phase | Model-relative within-session differences; not creativity scores |
| **Human initiation** | Human-originated validated roots ÷ all validated roots with known origins | How many checked idea lineages appear to begin with the participant |
| **Human / AI branch creation** | Count of source-specific ideas marked as new branches | Who opened new conceptual directions |
| **Challenge rate** | Human turns classified as challenges ÷ all human turns | How often the participant questioned, rejected, or reversed a contribution |
| **Lexical diversity** | Unique human word tokens ÷ all human word tokens | Surface-level vocabulary variation |
| **Extracted human-turn ideas** | Number of ideas expressed in human turns | Contribution count, including shared or uncertain origins; not independent trials |
| **Human synthesis / reframing** | Counts of unique human turns carrying each operation | How often the participant combined ideas or changed the frame; AI operations are excluded |
| **Response timing** | Median recorded human response time | Interaction pacing, including reading and typing time |

Two collaboration-specific calculations require the provenance graph:

```text
AI creative pull
  = 1 − mean distance(human idea, each direct AI parent)

AI centroid
  = mean embedding of all AI-originated ideas

Divergence recovery
  = mean distance(independent human ideas, AI centroid)
    − mean distance(co-creation human ideas, AI centroid)
```

Higher **AI creative pull** means human ideas stayed semantically closer to the AI ideas identified as their direct parents. Positive **divergence recovery** means the participant moved farther from the aggregate AI territory after the model stopped contributing. Neither calculation proves causality: the parent links are inferred and the distances depend on the embedding model.

### 5. Idea map

The idea map now plots the actual minimum embedding distance to earlier ideas on its vertical axis, rather than a principal-component projection. Higher dots represent larger distances in the selected model. The first idea has no earlier comparison and is placed at the bottom as a visual convention. Horizontal positions follow extracted-idea order within the transcript. For readability, the map may display a chronological subset; its lines connect displayed steps and do not claim to be genealogy links or proportional elapsed time. Use the genealogy view to inspect inferred parent relationships.

### 6. Model-based judgments

Some constructs cannot be recovered with arithmetic alone. The structured analysis model therefore judges:

- whether AI amplified an existing human direction;
- evaluative depth, including explicit criteria, trade-offs, critique, and revision;
- possible AI preemption, where a model suggestion may have displaced an emerging human direction; and
- co-creative emergence, where an idea appears to depend meaningfully on both participants.

These fields are labeled **model judgments**. Ratings use an uncalibrated 0–1 rubric and counts represent model classifications; neither is a measured percentage improvement in creativity. Each includes a rationale, supporting transcript turns, and uncertainty. Evaluative-depth evidence is scoped to humans; collaboration judgments require both roles. Unsupported judgments are withheld. Possible preemption should be zero when no displacement is observed; absence of evidence does not prove absence of influence.

### 7. Confidence, uncertainty, and evidence lineage

Calculated measures no longer derive confidence labels from observation counts. The interface shows the number of **distinct supporting transcript turns**, method, and speaker scope. Five ideas from one answer still have one supporting turn, and those turns are not independent trials. Extraction annotations retain the model’s own self-rating only where explicitly labeled **uncalibrated**. No inter-method agreement or statistical reliability is claimed.

Every dashboard row follows the same inspectable shape:

```ts
{
  key: "divergenceRecovery",
  rawValue: /* calculated number or null */,
  displayValue: /* formatted value or "Insufficient data" */,
  interpretation: "Whether human ideas moved farther from the AI idea centroid...",
  method: "calculated",
  speakerScope: "both",
  supportingTurnCount: 3,
  uncertainty: "A short phase may contain too few ideas for a stable comparison.",
  evidenceTurnIds: [/* supporting transcript turns */]
}
```

Evidence IDs and speaker requirements are checked against the transcript. Missing or invalid judgment evidence produces diagnostics. Cards spanning multiple turns open all relevant turns in chronological order. Missing calculations return `null` and display **Insufficient data**. If extraction or relationship review remains incomplete after bounded retries, metrics are withheld rather than calculated from a silently truncated graph.

### Why there is no single creativity score

Collapsing this process into one number would hide the distinction between producing many ideas, moving across semantic space, critically evaluating a suggestion, preserving human agency, and generating something genuinely co-created. Locus keeps those dimensions separate so a researcher can inspect the assumptions and a participant can receive a useful explanation without being assigned a supposed fixed creative ability.

## Research limitations and threats to validity

Locus is an instrument-development prototype. It can generate structured, inspectable hypotheses about one conversation; it cannot yet establish that AI caused a change in creativity or that any displayed measure captures a stable property of a person. A research-facing reading of the dashboard should keep the following limitations visible.

| Limitation | Why it matters |
| --- | --- |
| **Construct validity** | Semantic distance, idea count, branching, and lexical variety are operational proxies. Creativity also involves usefulness, appropriateness, quality, surprise, and context; none of those can be reduced to distance alone. |
| **No causal identification** | The phases occur in a fixed sequence within one session. Practice, fatigue, the changing instructions, exposure to earlier ideas, and AI participation are confounded. A higher post-AI value does not show that AI caused the increase. |
| **No independent counterfactual** | The app does not observe what the same participant would have produced at the same moment without AI, with question-only support, or with a human collaborator. Terms such as “AI amplification,” “pull,” and “preemption” are therefore descriptive or inferential, not causal effects. |
| **Model-as-measurement risk** | A language model segments ideas and judges provenance, branches, operations, and co-creative emergence. Those classifications can reflect prompt wording, provider behavior, and common-method bias—especially when related models both participate in and evaluate the exchange. |
| **Extraction uncertainty** | There is no uniquely correct way to split prose into atomic ideas or assign parent links. Different defensible segmentations can change counts, genealogy, novelty, and downstream distances. The current pipeline has not been calibrated against blinded human coders. |
| **Embedding dependence** | Cosine distance reflects the geometry of one embedding model, not literal cognitive or neural distance. Results can vary across embedding models, languages, phrasing, preprocessing choices, and model updates. Semantically remote output can also be irrelevant rather than creative. |
| **Sparse within-phase samples** | A short, self-paced conversation may yield only one or two usable ideas in a phase. Point estimates can then be unstable. Supporting-turn counts are evidence quantities, not confidence intervals, reliability coefficients, or posterior probabilities. Model self-ratings are uncalibrated. |
| **Protocol and demand effects** | Participants know they are in a creativity exercise and receive an explicit creativity cue. The task prompt, guide questions, and awareness of evaluation may change behavior independently of collaboration with AI. |
| **Task and population generalizability** | One English-language public-space design task cannot establish performance across creative domains, cultures, languages, expertise levels, accessibility needs, or repeated real-world AI use. Self-selection into the experience may further narrow the population. |
| **Timing ambiguity** | Response time includes reading, typing, interruption, device differences, and deliberation. It must not be interpreted as processing speed, effort, fluency, or a neural measure. |
| **Reproducibility and model drift** | Generative classifications may vary across runs, and provider models can change over time. Locus records the model identifiers used, but a model name alone may not guarantee exact future reproducibility. |
| **Multiple exploratory outputs** | The dashboard exposes many related metrics. Selecting an appealing change after seeing the results would inflate the risk of a false narrative unless hypotheses and analysis choices were specified in advance. |
| **No psychometric or external validation yet** | The measures do not yet have established test–retest reliability, inter-rater reliability, convergent or discriminant validity, sensitivity, or predictive validity against independent creative outcomes. |
| **Privacy and research ethics** | Transcript text is sent to configured model providers for generation and analysis. A real study would require explicit consent, a documented retention policy, data minimization, appropriate institutional review, and careful handling of potentially identifying text. |

The brain and neural-network imagery on the landing page is conceptual. Locus collects text and interaction timing only; it records no neural, physiological, clinical, or diagnostic data and supports no claim about literal brain function.

### Safeguards already present

- Calculated metrics are kept separate from model judgments.
- Judgment-based fields require a rationale, uncertainty statement, and valid evidence from the relevant speakers. Model self-ratings are not statistical confidence.
- Missing comparisons and metrics affected by incomplete analysis return `null` and appear as **Insufficient data**.
- The report avoids a composite creativity score and avoids claims about intelligence, personality, diagnosis, or stable ability.
- Results identify the text-generation and embedding models used so model dependence is visible.
- The personal report describes patterns in **this session**, while the research dashboard preserves the underlying evidence for inspection.
- Protocol labels are hidden during conversation. Personal results are explicitly tentative and use checked quotes; rejection alone is not treated as evidence of harm.

These are transparency safeguards, not substitutes for validation.

### What a credible validation program would require

Before using Locus as a research instrument, the next phase should include:

1. **Preregistered constructs and hypotheses:** define each measure, primary outcomes, exclusion rules, and planned comparisons before examining results.
2. **Randomized and counterbalanced conditions:** compare unaided work, question-only facilitation, generative AI collaboration, and appropriate human or active-control conditions across equivalent prompt forms.
3. **Independent outcome assessment:** use blinded expert or consensual ratings of the final creative products so process measures are not validated only against another model judgment.
4. **Human-coded calibration:** develop an annotation manual for atomic ideas, provenance, branches, synthesis, reframing, and preemption; then report agreement among multiple blinded coders and agreement between coders and the pipeline.
5. **Reliability and robustness testing:** repeat sessions and rerun analyses across prompts, judge models, embedding models, languages, and model versions; report sensitivity analyses rather than a single preferred configuration.
6. **Adequately powered sampling:** collect enough participants and within-phase observations to estimate uncertainty, effect sizes, heterogeneity, and interactions without treating a five-minute session as a stable trait assessment.
7. **External-validity tests:** examine whether session measures relate to independent creative behavior while remaining distinguishable from verbosity, vocabulary, topic knowledge, compliance, and general language ability.
8. **Research governance:** establish consent, privacy, retention, accessibility, adverse-event, and human-review procedures appropriate to the study setting.

Until that work is completed, Locus should be described as an exploratory behavioral prototype and hypothesis-generation tool—not a validated creativity test.

## Scientific motivation

Locus draws inspiration from research treating creativity as a dynamic state that can change within a person, rather than only as a stable trait. Several ideas are especially relevant:

- [Connecting long distance](https://pubmed.ncbi.nlm.nih.gov/19383937/) linked greater semantic distance in analogical reasoning with activity in left frontopolar cortex.
- [Thin slices of creativity](https://pmc.ncbi.nlm.nih.gov/articles/PMC4105589/) examined whether brief verbal behavior can carry measurable information about creative cognition.
- [Frontopolar activity and connectivity support dynamic conscious augmentation of creative state](https://pmc.ncbi.nlm.nih.gov/articles/PMC6869232/) studied short-duration, cued changes in creative state.
- [Conscious augmentation of creative state enhances “real” creativity](https://pubmed.ncbi.nlm.nih.gov/26959821/) found that an explicit cue increased semantically distant analogical connections without simply producing indiscriminate responses.

Locus does **not** reproduce those experimental paradigms, and its language-model-assisted measures are not direct equivalents of the behavioral or neuroimaging measures in those papers. The research motivates questions and interface structure; it does not validate the app's outputs.

## Interpretation boundary

Locus is a research prototype, not a psychological or neuroscience assessment. Its outputs must not be used to diagnose people, rank ability, select candidates, or make claims about intelligence, personality, brain function, or stable creative capacity.

Results describe one short conversation and depend on the prompt, transcript length, language model, embedding model, extraction choices, and the participant's context. Confidence labels communicate local evidence quality; they are not psychometric reliability estimates.

## Technology

- Next.js App Router and TypeScript
- React and Tailwind CSS
- Vercel AI SDK
- OpenAI structured generation and embeddings
- Zod runtime validation
- Vercel deployment

The provider calls are isolated in `app/api/chat/route.ts` and `app/api/analyze/route.ts`. The current implementation uses OpenAI for both structured analysis and embeddings. Other AI SDK text providers can be adapted, but a replacement semantic-analysis strategy is also required if that provider does not offer compatible embeddings; an arbitrary provider key will not work without that adapter.

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm
- an OpenAI API key

### Setup

```bash
git clone https://github.com/jabbmate/locus-ai-creativity.git
cd locus-ai-creativity
npm install
cp .env.example .env.local
```

Then add your key to `.env.local`:

```dotenv
NEXT_PUBLIC_AI_MODE=mock
OPENAI_API_KEY=your_new_key_here
OPENAI_MODEL=gpt-5.6
OPENAI_ANALYSIS_MODEL=gpt-5.6
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`NEXT_PUBLIC_AI_MODE=mock` keeps the guided protocol deterministic, but the final report is still generated from the real transcript and requires the server-side key. Set it to `live` if you also want model-generated guide replies.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Server-only credential used for analysis and live guide replies |
| `NEXT_PUBLIC_AI_MODE` | No | `mock` for deterministic guide prompts; `live` for generated guide replies |
| `OPENAI_MODEL` | No | Model used for live guide replies |
| `OPENAI_ANALYSIS_MODEL` | No | Model used for structured transcript analysis |
| `OPENAI_EMBEDDING_MODEL` | No | Embedding model used for semantic comparisons |

Never commit `.env.local` or paste a real API key into an issue, pull request, chat, or source file. Use a newly generated key if a credential has ever been exposed.

## Data and privacy

Before the first submission, the composer explains what is processed and links to the [privacy and retention page](app/privacy/page.tsx). In live mode, recent text goes to the AI provider after each message. At completion, the full transcript and timing go to the analysis provider; extracted idea text is sent for embeddings.

There is no session database. The app holds the active transcript and deduplicated analysis request/result in browser memory, plus server memory during processing. “New session” clears session data and the session-owned cache, aborts pending requests, and prevents old responses from replacing a new session. Both APIs use `Cache-Control: no-store`. Application errors log only generic categories, never raw provider errors or transcript text. These measures are not secure memory erasure, and no zero-retention promise is made about model or hosting providers. Avoid private or identifying information.

## Development checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium # once, for browser tests
npm run test:e2e
```

Unit and route integration tests use synthetic transcripts and injected/mock model and embedding responses. Browser tests intercept API responses and run an isolated local server with an empty provider key. They cover full and early completion, multi-turn evidence, incomplete extraction, retries, privacy accessibility, restart, and stale-response protection. They do not call paid providers. Passing these software tests does not validate the research instrument. Provider-backed semantic accuracy, cost, latency, human-coder agreement, and research validity require separate evaluation.

## Contributing

Contributions are welcome, particularly around experimental design, inter-rater validation, provider adapters, privacy-preserving analysis, reproducible metric definitions, and accessible data visualization. Please open an issue before proposing a major protocol or interpretation change so the scientific assumptions can be discussed explicitly.

## License

Released under the [MIT License](LICENSE).
