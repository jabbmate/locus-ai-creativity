# Locus

**See how your ideas move with LLMs.**

Locus is an open-source human–AI creativity experiment. It guides someone through a short creative conversation, separates the ideas contributed by the human and the model, and produces two views of the interaction:

- a plain-language personal report about how the collaboration appeared to affect the participant's thinking; and
- an evidence-linked research dashboard for inspecting idea provenance, semantic movement, creative operations, uncertainty, and the underlying transcript.

> **Try it:** [Open the live Locus experiment](https://locus-ai-creativity.vercel.app)

![Locus human brain and language-model visualization](public/locus-cognition-duet.png)

## Why I built this

I graduated from the University of Pennsylvania with a degree in cognitive science. A friend working in Adam Green's lab introduced me to his research, and I became fascinated by a question that already felt personally important: when I use AI constantly, is it extending my creativity, redirecting it, or quietly narrowing it?

I built Locus as a way to understand those ideas more concretely. Rather than assigning a single opaque “creativity score,” the project tries to reconstruct what happened during one interaction: which ideas began with the human, what the model introduced, where the human challenged or reframed the model, and what emerged only through collaboration.

Locus is an independent exploratory project. It is not affiliated with or endorsed by Adam Green, Georgetown University, or the University of Pennsylvania.

## The participant experience

The guided protocol moves through five stages:

1. **Baseline ideation** — the participant develops initial directions before the model contributes concepts.
2. **Creative cue** — the participant is explicitly asked to make a less obvious connection.
3. **Co-creation** — human and model extend, challenge, branch, and synthesize ideas together.
4. **Independent thinking** — the model stops supplying ideas and the participant takes the concept somewhere new.
5. **Reflection** — the participant identifies what surprised them and when the direction felt like their own.

There is no countdown. A participant can think at their own pace and finish once they have provided at least one response.

## What the analysis measures

Every completed session is analyzed from its actual transcript. The report does not substitute a canned sample if analysis fails.

### Idea structure and agency

- atomic idea extraction
- human, AI, or co-created provenance
- idea genealogy and parent relationships
- human and AI branch creation
- human initiation
- AI amplification
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

Each research metric includes a display value, raw value where applicable, interpretation, confidence level, uncertainty statement, and links to supporting transcript turns.

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
              phase novelty, AI pull, trajectory projection
        │
        ▼
Personal report + inspectable research dashboard
```

The analysis endpoint uses schema-validated structured output for text-dependent classification and interpretation. Deterministic application code then calculates counts, ratios, timing summaries, cosine-distance measures, and the semantic-map projection. Invalid evidence references and forward-pointing genealogy links are rejected before results reach the interface.

If the model call or embedding step fails, Locus shows an explicit retry screen. It does not fall back to example measurements.

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

Locus currently has no application database and does not intentionally persist completed sessions. The transcript is sent to the configured model provider when the report is generated, and a live guide also sends recent conversation turns to that provider. Hosting and model providers may retain operational logs according to their own policies. Do not enter confidential, medical, or identifying information into a public demo.

## Development checks

```bash
npm run build
npm run lint
```

## Contributing

Contributions are welcome, particularly around experimental design, inter-rater validation, provider adapters, privacy-preserving analysis, reproducible metric definitions, and accessible data visualization. Please open an issue before proposing a major protocol or interpretation change so the scientific assumptions can be discussed explicitly.

## License

Released under the [MIT License](LICENSE).
