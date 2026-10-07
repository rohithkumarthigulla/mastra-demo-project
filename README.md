# EquipmentExchange

A construction-equipment rental marketplace: suppliers list equipment, and builders request it for a date range.

The project is built issue by issue. This skeleton creates the folder structure; later issues fill it in. Only the `health` module is implemented — every other file is a compiling placeholder.

## Structure

```
apps/
  api/                  NestJS + Fastify + Drizzle on PostgreSQL (@ee/api)
    src/platform/       cross-cutting infrastructure: auth, config, database, http, logging, types
    src/modules/<name>/ one folder per domain module, split into
                          application/     use cases
                          domain/          entities and rules
                          http/            controllers
                          infrastructure/  persistence and external services
    src/scripts/        one-off operational scripts
    drizzle/            generated migrations
  client/               Expo app for iOS, Android and web (@ee/client)
    app/                expo-router routes (builder, supplier, equipment, listing, sign-in)
    api/                typed api client
    platform/           device and runtime integration
    features/<name>/    feature code (auth, equipment, rental, quotes, supplier, ...)
packages/
  contracts/            Zod schemas shared by the api and the client (@ee/contracts)
docs/knowledge/         reference material for the AI assistants
docker-compose.yml      PostgreSQL 17 with pgvector
```

## Run it

Requirements: Node 22 (see `.nvmrc`), pnpm, Docker.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up                          # start PostgreSQL on localhost:5432
pnpm build
pnpm --filter @ee/api db:migrate    # apply database migrations
pnpm --filter @ee/api start         # api on http://localhost:3000
curl http://localhost:3000/health   # {"status":"ok"}
pnpm --filter @ee/client web        # client in the browser
```

The api validates its environment on startup and exits with a clear message if anything is missing:

| Variable       | Required | Meaning                                                 |
| -------------- | -------- | ------------------------------------------------------- |
| `DATABASE_URL` | yes      | PostgreSQL connection string                            |
| `PORT`         | no       | port to listen on (default `3000`)                      |
| `CORS_ORIGINS` | no       | comma-separated allowed origins; CORS is off when empty |

`GET /health` returns 503 `{"code":"database_unavailable",...}` when the database is down or migrations have not been applied.

## Scripts

| Script                              | What it does                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm build`                        | builds contracts, api and the client web export                                     |
| `pnpm typecheck`                    | runs `tsc --noEmit` in every package                                                |
| `pnpm lint`                         | ESLint over the whole repo                                                          |
| `pnpm format:check`                 | Prettier check                                                                      |
| `pnpm test`                         | Node test runner over `dist/` for the api, Vitest elsewhere; run `pnpm build` first |
| `pnpm db:up`                        | starts PostgreSQL 17 + pgvector with Docker Compose                                 |
| `pnpm db:down`                      | stops it                                                                            |
| `pnpm --filter @ee/api db:generate` | generates a migration from `src/platform/database/schema.ts`                        |
| `pnpm --filter @ee/api db:migrate`  | applies pending migrations                                                          |

CI (`.github/workflows/ci.yml`) runs these checks against PostgreSQL on every push and pull request, then smoke-tests `GET /health`.
