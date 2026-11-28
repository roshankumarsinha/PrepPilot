# PrepPilot

AI co-pilot for interview prep: RAG + MCP agents over my own GitHub notes repos
(backend/frontend system design, HLD, LLD, DSA, AI notes, NestJS, Node, JS, React).

The full build plan is in `docs/PLAN.md` (phases 0–8). Always read the section for
the current phase before starting work, and check its "Done when" line before
calling a phase finished.

## Constraints (non-negotiable)

- **Zero cost.** No paid APIs, no cloud services, no hosted databases.
- **Never add an Anthropic API key** or any code that calls the Anthropic API.
  Claude's reasoning happens in Claude Code / Claude Desktop through our MCP server.
- Everything runs locally: Postgres in Docker, embeddings via Ollama.
- This is a portfolio project: code should be production quality and easy to read.

## Stack

- pnpm workspaces monorepo
  - `apps/api` — NestJS + TypeScript (REST API, sync worker, MCP server entry point)
  - `apps/web` — React + Vite + TypeScript, TanStack Query, React Router,
    Tailwind + shadcn/ui, Recharts
  - `packages/shared` — shared types and Zod schemas
- Postgres 16 + pgvector (Docker Compose), Drizzle ORM + drizzle-kit migrations
- Embeddings: Ollama `nomic-embed-text` (768 dimensions)
- MCP: `@modelcontextprotocol/sdk`, stdio transport, separate entry `apps/api/src/mcp.main.ts`
- Live updates: Postgres LISTEN/NOTIFY → API → Server-Sent Events → browser
- Scheduling: `@nestjs/schedule`

## Architecture rules

- All state lives in Postgres. The MCP process and the API server never share memory.
- Every MCP tool call is written to `agent_events` and announced with `NOTIFY`.
- Chunks store `content_hash`; only new hashes are embedded. Sync is driven by
  `git diff --name-status <last_indexed_sha>..HEAD`.
- Business logic lives in services that both the REST controllers and the MCP
  tools call; controllers and tools stay thin.
- An `LlmProvider` interface wraps any in-app LLM use (Ollama only).

## Code conventions

- TypeScript `strict` everywhere. No `any` unless commented why.
- Validate env/config and all external input with Zod.
- Every feature ships with tests (Vitest in `web`/`shared`, Jest in `api`).
- Keep functions small and named for what they do; prefer clarity over cleverness.
- Use `pnpm` only (never npm or yarn).

## Git workflow

- Default branch is `master`.
- One branch per phase: `feat/phase-<n>-<short-name>`.
- Small commits with Conventional Commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Open a PR to `master` with `gh pr create` when a phase is done; the PR description
  lists what was built and how the "Done when" check was verified.
- Never commit `.env`, `data/repos/`, or anything with secrets.

## Commands (fill in as they are created)

- `docker compose up -d` — start Postgres + pgvector
- `pnpm install` — install all workspaces
- `pnpm db:migrate` — apply database migrations
- `pnpm sync [repo]` — sync the notes repos in `repos.yaml` now (needs Ollama running)
- `pnpm dev` — run api + web together
- `pnpm lint` / `pnpm test` — lint and test everything
