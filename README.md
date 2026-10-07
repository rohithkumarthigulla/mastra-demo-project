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

## Getting started

Requirements: Node 22 (see `.nvmrc`), pnpm, Docker.

```sh
pnpm install
pnpm build
pnpm db:up                        # start PostgreSQL on localhost:5432
pnpm --filter @ee/api start       # api on http://localhost:3000
curl http://localhost:3000/health # {"status":"ok"}
pnpm --filter @ee/client web      # client in the browser
```

Copy `apps/api/.env.example` to configure `PORT` and `DATABASE_URL`.

## Scripts

| Script              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `pnpm build`        | builds contracts, api and the client web export     |
| `pnpm typecheck`    | runs `tsc --noEmit` in every package                |
| `pnpm lint`         | ESLint over the whole repo                          |
| `pnpm format:check` | Prettier check                                      |
| `pnpm test`         | Vitest in every package                             |
| `pnpm db:up`        | starts PostgreSQL 17 + pgvector with Docker Compose |
| `pnpm db:down`      | stops it                                            |

CI should run the same checks on every push and smoke-test `GET /health`.
