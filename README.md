# EquipmentExchange

A construction-equipment rental marketplace for Indian cities. **Suppliers** list their machines (excavators, loaders, telehandlers, …), manage their fleet and availability, and answer rental requests with quotes. **Builders** browse the catalogue, request equipment for a date range, accept quotes, follow their bookings, and post requirements that go out to several suppliers at once. Both sides get in-app notifications and an optional AI assistant.

## What's in it

| Area                 | Builder                                              | Supplier                                                           | Details                                                                                    |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Catalogue            | browse listings and equipment models, filter by spec | create listings, photos, rate cards                                | [api reference](docs/api-reference.md#listings)                                            |
| Fleet & availability | —                                                    | yards, machines (units), maintenance blocks, availability calendar | [api reference](docs/api-reference.md#fleet), [supplier screens](docs/supplier-screens.md) |
| Requests → bookings  | request, accept or reject quotes, track bookings     | incoming requests, quotes, booking stages, tracker                 | [rental flow](docs/rental-flow.md)                                                         |
| Requirements         | post a need, send it to matching listings            | receives it as a rental request                                    | [requirements](docs/requirements.md)                                                       |
| Notifications        | ✓                                                    | ✓                                                                  | [requirements](docs/requirements.md#notifications)                                         |
| AI assistants        | equipment assistant                                  | supplier agent (confirms before changing anything)                 | [assistants](docs/assistants.md)                                                           |
| Equipment knowledge  | model specifications and taxonomy                    | same                                                               | [api reference](docs/api-reference.md#equipment-knowledge-base)                            |

Route-by-route contracts are in [docs/contracts.md](docs/contracts.md). Deployment is in [docs/deployment.md](docs/deployment.md).

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
    src/scripts/        seed, demo data and knowledge ingest scripts
    drizzle/            generated migrations
  client/               Expo app for iOS, Android and web (@ee/client)
    app/                expo-router routes (builder, supplier, equipment, listing, sign-in)
    api/                typed api client
    platform/           device and runtime integration
    features/<name>/    feature code (auth, equipment, navigation, rental, quotes, supplier, ...)
packages/
  contracts/            Zod schemas shared by the api and the client (@ee/contracts)
src/
  mastra/               Mastra agents, tools and workflows, run locally in Mastra Studio
docs/                   feature docs, walkthrough, deployment
docs/knowledge/         reference material for the AI assistants
docker-compose.yml      PostgreSQL 17 with pgvector
```

## Run it

Requirements: Node 22 (see `.nvmrc`), pnpm, Docker.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # local defaults; works as-is
pnpm db:up                               # PostgreSQL on localhost:5432
pnpm build
pnpm --filter @ee/api db:migrate         # apply database migrations
pnpm --filter @ee/api db:seed            # equipment models, cities, taxonomy (safe to re-run)
pnpm --filter @ee/api demo:hyderabad     # optional: demo accounts and data, see below
pnpm --filter @ee/api start              # api on http://localhost:3000
curl http://localhost:3000/health        # {"status":"ok"}
pnpm --filter @ee/client web             # client on http://localhost:8081
```

`GET /health` returns 503 `{"code":"database_unavailable",...}` when the database is down or migrations have not been applied. Every environment variable is listed in [docs/deployment.md](docs/deployment.md#environment-variables); the assistants need `GEMINI_API_KEY` and everything else works without it.

## Demo data

`pnpm --filter @ee/api demo:hyderabad` fills a local database with a small, realistic Hyderabad marketplace so you can try every screen straight away:

- two suppliers (Deccan Earthmovers, Charminar Cranes & Loaders), each with a yard, two listings with photos, and machines; one machine has a maintenance block;
- two builders (Gachibowli Constructions, Kukatpally Infra);
- requests and bookings at every stage: new request, quote waiting for supplier approval, quote sent, booking confirmed, on rent, returned;
- one requirement sent to an excavator listing from each supplier.

It prints the accounts when it finishes. All use the password `DemoPass#2026`:

| Email                                             | Role     |
| ------------------------------------------------- | -------- |
| `supplier.deccan@demo.equipmentexchange.local`    | supplier |
| `supplier.charminar@demo.equipmentexchange.local` | supplier |
| `builder.gachibowli@demo.equipmentexchange.local` | builder  |
| `builder.kukatpally@demo.equipmentexchange.local` | builder  |

- **Local development only.** The script refuses to run when `NODE_ENV=production`.
- **Run it again** and nothing changes. To start over, remove it first.
- **Remove it** with `pnpm --filter @ee/api demo:hyderabad --remove`. This deletes every demo row and photo file, and nothing else.
- Dates are relative to today, so run it on the day you demo.
- The few specification values it adds cite a source called "Demo data (not real manufacturer figures)".

A step-by-step tour using this data, with what you should see at each step: [docs/walkthrough.md](docs/walkthrough.md).

## Checks

Run all of these before opening a pull request. The api tests need the database from `pnpm db:up`, migrated and seeded.

```sh
pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

| Script                                 | What it does                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm build`                           | builds contracts, api and the client web export                                     |
| `pnpm typecheck`                       | runs `tsc --noEmit` in every package and over `src/mastra`                          |
| `pnpm lint`                            | ESLint over the whole repo                                                          |
| `pnpm format:check`                    | Prettier check (`pnpm format` fixes it)                                             |
| `pnpm test`                            | Node test runner over `dist/` for the api, Vitest elsewhere; run `pnpm build` first |
| `pnpm db:up` / `pnpm db:down`          | starts / stops PostgreSQL 17 + pgvector with Docker Compose                         |
| `pnpm --filter @ee/api db:generate`    | generates a migration from `src/platform/database/schema.ts`                        |
| `pnpm --filter @ee/api db:migrate`     | applies pending migrations                                                          |
| `pnpm --filter @ee/api db:seed`        | loads equipment knowledge reference data (idempotent)                               |
| `pnpm --filter @ee/api demo:hyderabad` | loads the Hyderabad demo data (idempotent; `--remove` deletes it)                   |
| `pnpm --filter @ee/api agent:ingest`   | loads `docs/knowledge/` into the supplier agent's knowledge base                    |
| `pnpm mastra:dev`                      | starts Mastra Studio for the agents in `src/mastra`                                 |

## Documentation

| Doc                                             | Covers                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| [walkthrough.md](docs/walkthrough.md)           | guided tour of every flow with the demo data                       |
| [api-reference.md](docs/api-reference.md)       | auth, roles, knowledge base, listings, fleet, availability, client |
| [rental-flow.md](docs/rental-flow.md)           | requests, quotes, bookings, availability, notifications            |
| [requirements.md](docs/requirements.md)         | requirements, matching and sending to suppliers                    |
| [supplier-screens.md](docs/supplier-screens.md) | supplier app screens and the tracker                               |
| [assistants.md](docs/assistants.md)             | equipment assistant and supplier agent                             |
| [mastra.md](docs/mastra.md)                     | Mastra agents in `src/mastra`, Studio, adding an agent             |
| [contracts.md](docs/contracts.md)               | every route and its shared schema                                  |
| [deployment.md](docs/deployment.md)             | environment variables, Docker, Railway, EAS, web build             |
