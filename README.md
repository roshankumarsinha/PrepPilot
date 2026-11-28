# PrepPilot

AI co-pilot for interview prep: RAG + MCP agents over my own GitHub notes repos.

See [`docs/PLAN.md`](docs/PLAN.md) for the full build plan.

## Stack

- **`apps/api`**: NestJS + TypeScript (REST API, notes sync; later the MCP server)
- **`apps/web`**: React + Vite + TypeScript, TanStack Query, Tailwind CSS
- **`packages/shared`**: types and Zod schemas used by both apps
- **Postgres 16 + pgvector** in Docker; Drizzle ORM
- **Ollama** with `nomic-embed-text` (768 dimensions) for embeddings

Everything runs locally and costs nothing.

## Getting started

Prerequisites: Node 24 (see `.nvmrc`), pnpm 9 (`corepack enable`), Docker, and
[Ollama](https://ollama.com/download) with the embedding model pulled:

```sh
ollama pull nomic-embed-text
```

Then:

```sh
cp .env.example .env     # defaults match docker-compose.yml
docker compose up -d     # Postgres 16 + pgvector on :5432
pnpm install
pnpm db:migrate          # create the tables
pnpm sync                # clone the notes repos and index them (first run takes ~2 min)
pnpm dev                 # API on :3000, web on :5173
```

Open http://localhost:5173. The page calls `GET /health`, which reports whether the API
can reach the database and Ollama (HTTP 200 when both are up, 503 otherwise).

## How notes are indexed

The repos to index, and which files in each, are listed in [`repos.yaml`](repos.yaml).
Each repo is cloned into `data/repos/<name>` (git-ignored).

A sync, for each repo:

1. Fetches the latest commit and finds the changed files with
   `git diff --name-status <last indexed commit>..HEAD`. The first sync, or a sync after
   `repos.yaml` changes, checks every matching file instead.
2. Parses each changed file into chunks: markdown (including HTML-written notes) and `.txt`
   notes are split at headings and keep their heading path and line numbers; `.cpp`/`.js`
   solutions become one chunk per problem, with the C++ and JS versions linked.
3. Hashes every chunk and embeds only hashes that are new. Unchanged text keeps its
   embedding, and moved text reuses one already computed.
4. Records the run in `sync_runs`: files changed, chunks added/removed/embedded.

Syncs run every 15 minutes while the API is up (`SYNC_CRON`, `SYNC_SCHEDULE_ENABLED`), on
`pnpm sync`, or through the API. Only one sync runs at a time (a Postgres advisory lock).

| Endpoint           | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `GET /health`      | Database and Ollama status                                         |
| `GET /repos`       | Each repo with its last indexed commit and document/chunk counts   |
| `GET /sync/runs`   | The sync log, newest first (`?limit=50&repo=DSA`)                  |
| `POST /sync`       | Start syncing every repo in the background (409 if one is running) |
| `POST /sync/:repo` | Start syncing one repo                                             |

## Scripts

| Command            | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `pnpm dev`         | Run API, web and `shared` in watch mode                               |
| `pnpm build`       | Build every package                                                   |
| `pnpm db:migrate`  | Apply database migrations (`apps/api/drizzle`)                        |
| `pnpm sync [repo]` | Sync every repo (or one) now and print a summary                      |
| `pnpm lint`        | ESLint (type-aware) across the monorepo                               |
| `pnpm format`      | Format with Prettier (`format:check` to verify only)                  |
| `pnpm typecheck`   | `tsc --noEmit` in every package                                       |
| `pnpm test`        | Vitest (`web`, `shared`) and Jest (`api`, incl. e2e against Postgres) |

The API e2e tests need Postgres running (`docker compose up -d`). They use a separate
`preppilot_test` database, created and migrated automatically, so they never touch your index.
To change the schema, edit `apps/api/src/database/schema.ts` and run
`pnpm --filter @preppilot/api db:generate --name <change>`.
