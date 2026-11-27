# PrepPilot — Build Plan

Source doc (with diagrams): https://claude.ai/artifact/6WyLmZFX3uhMLneHdqD55N

## Overview

Build PrepPilot in 9 phases over about 12 weeks (at roughly 8 hours a week), with a working demo after phases 2, 5 and 8. The total cost is ₹0.

- **What it is:** a local app that indexes all your GitHub notes repos (backend and frontend system design, HLD, LLD, DSA, AI notes and the rest). It re-indexes only what changed whenever you push, and runs two agents on top: a **Mock Interviewer** and a **Notes Gardener**.
- **Why it's free:** Postgres, embeddings and an optional local chat model run on your laptop. Claude does the agent work through MCP on your Pro plan, so no API key is needed.
- **What the demo shows:** a React web app where you can search your notes, watch a sync happen, and follow an interview or Gardener run live, step by step, even while Claude is the one driving it from Claude Code.

## Architecture

One NestJS codebase serves both the web app (REST) and Claude (MCP), and both read and write the same Postgres database. Anything Claude does through MCP shows up in the UI.

```
GitHub notes repos ──> [ NestJS backend (one codebase)              ]
                       [   Sync worker: diff, chunk, hash, embed     ] ──> Ollama (embeddings + optional chat)
                       [   Core services: search, interview, gardener] ──> Postgres + pgvector
                       [   REST API + live events (SSE)              ] <── React demo app
                       [   MCP server (stdio)                        ] <── Claude Code / Desktop (Pro plan)
```

One detail matters for the live demo. Claude Code starts the MCP server as a **separate process** over stdio, so it can't share memory with the API server. The MCP process writes each tool call to an `agent_events` table and sends a Postgres `NOTIFY`. The API server `LISTEN`s and passes the event on to the browser over server-sent events (SSE).

| Layer | Choice | Why |
| --- | --- | --- |
| Backend | NestJS + TypeScript | One module each for sync, retrieval and agents |
| Database | Postgres 16 + pgvector in Docker | Vectors, full-text search and app data in one place |
| ORM | Drizzle | Typed SQL with a native pgvector column type |
| Embeddings | Ollama `nomic-embed-text` (768 dimensions) | Free and local |
| Main agent | Claude Code / Claude Desktop through MCP | Runs on the Pro plan |
| In-app agent (optional) | Ollama, a 7–8B model that can call tools (e.g. Qwen) | Free; works with Claude closed |
| MCP | `@modelcontextprotocol/sdk` (TypeScript) | Official SDK |
| Live updates | Postgres LISTEN/NOTIFY → SSE | Connects the MCP process to the browser |
| Frontend | React + Vite + TS, TanStack Query, Tailwind + shadcn/ui, Recharts | Quick to build and looks good in a demo |
| Scheduling | `@nestjs/schedule` | Sync timer every 15 minutes |

## Frontend for the demo

The web app has 7 pages and three ways for its AI features to run, so it can be demoed without an API key.

**Three ways the AI features run:**

1. **Mirror mode (main demo).** Claude Code or the desktop app runs the agent through MCP. The web app shows each question, answer, score and tool call as it happens. Put the two side by side on screen.
2. **In-browser mode (optional).** The interview runs entirely in the web app, using a local Ollama model behind an `LlmProvider` interface. It works with Claude closed. If an API key is ever added, an `AnthropicProvider` takes one class.
3. **Replay mode.** Every session is saved as events, so any past session can be replayed at its real pace. Backup if Claude hits a usage limit during a live demo.

| Page | What it shows | Powered by |
| --- | --- | --- |
| Dashboard | Repos indexed, chunk count, last sync per repo, weakest topics, recent activity | Database only |
| Repos & Sync | Last indexed commit per repo, files changed in each sync, a **Sync now** button with live progress | Sync worker + SSE |
| Search | Ranked chunks with heading path, score and GitHub link; repo filter; toggle between vector-only and hybrid search | Retrieval, no LLM |
| Interview | Start a session (round type, topic), live transcript, panel of the notes each question came from, score per answer, agent activity timeline | Claude via MCP, or Ollama |
| Progress | Weak-topic heatmap by repo and topic, score trend, topics due for review | Database only |
| Gardener | Each run's findings grouped as duplicate, contradiction, gap or missing link, both chunks side by side, Accept / Dismiss | Claude via MCP |
| Evals | Retrieval test results (hit@5, MRR) per run, compared across chunking settings | Eval runner, no LLM |

The **agent activity timeline** shows each tool call with its arguments, result and time taken. It's what makes the "agentic" part visible to someone watching.

## Phases

Each gate is a demo that can be shown on its own. Week counts are rough, assuming about 8 hours a week.

| Stage | Phases | Gate |
| --- | --- | --- |
| Foundation (weeks 1–4) | 0 Setup → 1 Sync → 2 Search + UI | Demo 1: search + live sync |
| Agents (weeks 5–9) | 3 MCP server → 4 Interviewer → 5 Gardener | Demo 2: Claude + live UI |
| Polish (weeks 10–12) | 6 Evals → 7 In-app LLM (optional) → 8 Polish | Final: README + video |

### Phase 0 · Setup (week 1)

- [ ] pnpm monorepo: `apps/api` (NestJS), `apps/web` (React + Vite), `packages/shared` (types and Zod schemas)
- [ ] `docker-compose.yml` with Postgres 16 + pgvector; install Ollama and pull `nomic-embed-text`
- [ ] ESLint, Prettier, Vitest/Jest; GitHub Actions running lint and tests (free on public repos)
- [ ] `CLAUDE.md` with project rules, so Claude Code follows the same conventions in every phase

**Done when:** `docker compose up` and `pnpm dev` show the web app calling `/health` successfully.

### Phase 1 · Ingestion and incremental sync (weeks 2–3)

- [ ] `repos.yaml` listing every notes repo; clone them into `data/repos/`
- [ ] Diff since the last indexed commit (`git diff --name-status <sha>..HEAD`) to get added, changed, deleted and renamed files
- [ ] One parser per format: markdown; HTML READMEs converted to markdown (turndown); `.js`/`.cpp` solutions as one chunk per file, titled with the problem name; `.txt`
- [ ] Split by heading, keeping the heading path, with a size cap and a small overlap; SHA-256 hash of each chunk's text
- [ ] Embed only new hashes, delete chunks that disappeared, record each run in `sync_runs`
- [ ] Sync every 15 minutes with `@nestjs/schedule`, plus a manual sync endpoint

**Done when:** you edit one section of one note, push, and the sync log shows exactly one chunk re-embedded.

### Phase 2 · Search and the first UI (week 4)

- [ ] Vector search (pgvector HNSW index, cosine) plus keyword search (Postgres `tsvector`), merged with reciprocal rank fusion
- [ ] Filter by repo and path; every result carries a GitHub link to its exact lines
- [ ] Web: Dashboard, Repos & Sync page with live SSE progress, Search page

**Done when (Demo 1):** you push a note, click Sync now, and the new text shows up in search.

### Phase 3 · MCP server (week 5)

- [ ] A second entry point in the same NestJS app (`mcp.main.ts`) using the MCP SDK over stdio
- [ ] Tools: `search_notes`, `get_chunk`, `list_topics`, `get_changes_since`
- [ ] Register it with Claude Code (`claude mcp add`) and in the Claude Desktop config
- [ ] Log every tool call to `agent_events` and send `NOTIFY`; the API forwards it over SSE; web: activity feed

**Done when:** asking Claude Code "What do my notes say about consistent hashing?" gives an answer with GitHub links, and the web feed shows the tool calls as they happen.

### Phase 4 · Mock Interviewer (weeks 6–7)

- [ ] Tables for sessions, questions, attempts and topic stats
- [ ] Tools: `start_session`, `next_question` (returns source chunks for a topic, favouring weak and due topics), `record_answer` (answer, score 0–10, feedback, chunk ids), `end_session`
- [ ] An MCP prompt `mock-interview` so it appears as a slash command in Claude Code
- [ ] Spaced repetition per topic (simple SM-2); a question is marked out of date when the hash of any source chunk changes
- [ ] Web: Interview page (live transcript, sources panel, activity timeline) and Progress page

**Done when:** a 10-minute LLD round in Claude Code shows up live in the web app, with scores and cited notes.

### Phase 5 · Notes Gardener (weeks 8–9)

- [ ] Backend finds candidate pairs cheaply: chunks changed since the last review, matched to their nearest neighbours above a similarity threshold
- [ ] Tools: `get_review_candidates`, `save_finding` (type, chunk ids, explanation, suggestion), `mark_reviewed`; prompt `gardener`
- [ ] Claude judges each pair: duplicate, contradiction, gap or missing link
- [ ] Web: Gardener page with Accept / Dismiss. Accepting writes a suggestions file; opening a PR is optional and only after confirmation

**Done when (Demo 2):** you add a note that repeats an existing one, run the Gardener, and the finding appears in the web app.

### Phase 6 · Evals (week 10)

- [ ] `evals.yaml` with about 30 questions, each with the path of the chunk that should come back
- [ ] A runner that computes hit@5 and MRR, stores each run, and compares chunking settings
- [ ] Web: Evals page with a chart across runs

**Done when:** you can state a measured improvement, such as hybrid search versus vector-only.

### Phase 7 · In-app LLM, optional (week 11)

- [ ] `LlmProvider` interface and an `OllamaProvider`; an agent loop in NestJS with a step limit that reuses the MCP tool functions
- [ ] Web: a "Run in browser" switch on the Interview page

**Done when:** a full interview runs in the browser with Claude closed. Skip this phase if the laptop can't spare about 8 GB of RAM.

### Phase 8 · Polish and demo package (week 12)

- [ ] Unit tests for the chunker and hash diff; integration tests with Testcontainers; retries and timeouts around Ollama; config checked with Zod at startup
- [ ] `pnpm seed` loads demo data; Replay mode for saved sessions
- [ ] README with the architecture diagram, GIFs and a 5-minute demo video
- [ ] Optional free public demo: build the web app in "demo mode" from a saved JSON snapshot and host it on GitHub Pages (no backend, no cost)

**Done when:** a fresh clone plus `docker compose up`, `pnpm dev` and `pnpm seed` gives a working demo in under 10 minutes.

## Data model

There are 12 tables. Storing `content_hash` on chunks and on questions is what makes incremental sync and out-of-date question detection work.

| Table | Key columns | Used for |
| --- | --- | --- |
| `repos` | name, url, local_path, last_indexed_sha, last_synced_at | Knowing where each sync starts from |
| `documents` | repo_id, path, content_hash | Skipping files whose content didn't change |
| `chunks` | document_id, heading_path, content, content_hash, start_line, end_line, embedding `vector(768)`, embed_model, tsv | Search, citations, re-embedding when the model changes |
| `sync_runs` | repo_id, from_sha, to_sha, files_changed, chunks_added, chunks_removed, status, duration_ms | Sync log on the Repos page |
| `agent_events` | session_id, source (mcp / ollama), tool, args, result_summary, latency_ms | Live activity timeline and Replay mode |
| `interview_sessions` | mode (claude / ollama), round_type, topic, started_at, ended_at | Interview page |
| `questions` | session_id, text, chunk_ids[], chunk_hashes[], is_stale | Marking questions out of date when notes change |
| `attempts` | question_id, answer, score (0–10), feedback | Scores and progress |
| `topic_stats` | topic, ease, interval_days, due_at, avg_score | Spaced repetition and weak-topic heatmap |
| `gardener_findings` | type, chunk_ids[], explanation, suggestion, status (open / accepted / dismissed) | Gardener page |
| `eval_cases`, `eval_runs` | question, expected_path; config, hit_at_5, mrr | Evals page |

## Demo script (5 minutes)

Claude Code on the left half of the screen, the web app on the right.

1. **0:00 Dashboard.** Repos and chunks indexed, when each repo last synced. Architecture diagram for 20 seconds.
2. **0:45 Search.** Search "consistent hashing". Point out heading paths, GitHub links, and the vector-only vs hybrid toggle.
3. **1:30 Live sync.** Edit a note on GitHub, click Sync now. The log shows 1 file and 1 chunk re-embedded; the new text comes up in search; a question built from that note is marked out of date.
4. **2:30 Mock interview.** Run `/mock-interview` in Claude Code. Each question appears on the right with its source notes; answer one, and the score, feedback and tool-call timeline update live.
5. **3:45 Progress.** Weak-topic heatmap and topics due for review.
6. **4:15 Gardener.** Run it after adding a note that repeats an existing one; accept the duplicate it finds.
7. **4:40 Evals.** Close on the measured retrieval numbers.

Backup: record a run of steps 4 and 6 so Replay mode can stand in if a usage limit is hit during the demo.

## Risks and open decisions

| Risk | What to do about it |
| --- | --- |
| Pro usage limit hit mid-demo or mid-build | Keep agent sessions short, run the Gardener on demand only, keep a recorded replay as backup |
| Laptop can't run a 7B chat model | Phase 7 is optional; the embedding model is small |
| Messy note formats (HTML READMEs, ChatGPT share links, code files) | One parser per format; drop chunks that are only links; one chunk per code file |
| MCP process and API server can't share memory | All state in Postgres; events cross over with LISTEN/NOTIFY |
| Scope growing past 12 weeks | Each gate is demoable alone; stop at Demo 2 if needed |

**Open decisions:**

- [ ] Monorepo tool: pnpm workspaces (simpler) or Nx (more structure)
- [ ] ORM: Drizzle (native pgvector type) or Prisma (familiar, but vectors need raw SQL)
- [ ] Interview scoring: a 0–10 score with a written rubric per round type (HLD, LLD, DSA, frontend)
- [ ] Public demo: GitHub Pages snapshot, or video only
