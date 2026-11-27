# PrepPilot

AI co-pilot for interview prep: RAG + MCP agents over my own GitHub notes repos.

See [`docs/PLAN.md`](docs/PLAN.md) for the full build plan.

## Stack

- **`apps/api`**: NestJS + TypeScript (REST API; later the sync worker and MCP server)
- **`apps/web`**: React + Vite + TypeScript, TanStack Query, Tailwind CSS
- **`packages/shared`**: types and Zod schemas used by both apps
- **Postgres 16 + pgvector** in Docker; Drizzle ORM

Everything runs locally and costs nothing.

## Getting started

Prerequisites: Node 24 (see `.nvmrc`), pnpm 9 (`corepack enable`), Docker.

```sh
cp .env.example .env     # defaults match docker-compose.yml
docker compose up -d     # Postgres 16 + pgvector on :5432
pnpm install
pnpm dev                 # API on :3000, web on :5173
```

Open http://localhost:5173. The page calls `GET /health`, which reports whether the
API can reach the database (HTTP 200 when healthy, 503 when the database is down).

## Scripts

| Command          | What it does                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `pnpm dev`       | Build `shared`, then run API, web and `shared` in watch mode          |
| `pnpm build`     | Build every package                                                   |
| `pnpm lint`      | ESLint (type-aware) across the monorepo                               |
| `pnpm format`    | Format with Prettier (`format:check` to verify only)                  |
| `pnpm typecheck` | `tsc --noEmit` in every package                                       |
| `pnpm test`      | Vitest (`web`, `shared`) and Jest (`api`, incl. e2e against Postgres) |

The API e2e test needs Postgres running (`docker compose up -d`).
