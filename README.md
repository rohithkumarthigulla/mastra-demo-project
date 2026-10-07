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

| Variable       | Required | Meaning                                                                              |
| -------------- | -------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL` | yes      | PostgreSQL connection string                                                         |
| `PORT`         | no       | port to listen on (default `3000`)                                                   |
| `CORS_ORIGINS` | no       | comma-separated allowed origins; CORS is off when empty                              |
| `JWT_SECRET`   | yes      | secret for signing access tokens, at least 32 characters (`openssl rand -base64 48`) |
| `NODE_ENV`     | no       | `development` (default), `test` or `production`; `production` marks cookies `Secure` |

`GET /health` returns 503 `{"code":"database_unavailable",...}` when the database is down or migrations have not been applied.

## Authentication

Accounts live in the `accounts` module (`apps/api/src/modules/accounts`). Request and response shapes are in `@ee/contracts` (`packages/contracts/src/accounts.ts`).

| Endpoint              | Body                                                  | Success                                                  |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `POST /auth/register` | `email`, `password` (min 8), `displayName`, `client?` | 201 `{ account, accessToken, expiresIn, refreshToken? }` |
| `POST /auth/login`    | `email`, `password`, `client?`                        | 200, same shape as register                              |
| `POST /auth/refresh`  | `refreshToken?`, `client?`                            | 200, same shape; the old refresh token stops working     |
| `POST /auth/logout`   | `refreshToken?`, `client?`                            | 204; revokes the refresh token                           |
| `GET /auth/me`        | header `Authorization: Bearer <accessToken>`          | 200 `{ id, email, displayName, createdAt }`              |

- **Passwords** are hashed with argon2id. Emails are trimmed, lower-cased and unique regardless of case.
- **Access tokens** are HS256 JWTs signed with `JWT_SECRET`. They expire after 15 minutes (`expiresIn: 900`).
- **Refresh tokens** are 32 random bytes and last 30 days. Only their SHA-256 hash is stored. Each refresh rotates the token, so reusing an old one returns 401.
- **Clients.** `client` is `"native"` (default) or `"web"`. Native clients get `refreshToken` in the response body and send it back in the body. Web clients get it in an `httpOnly`, `SameSite=Lax` cookie named `refresh_token` scoped to `/auth`; the cookie is never put in the body. Browsers on another origin must be listed in `CORS_ORIGINS` and send credentials.
- **Rate limit.** Each IP can make 10 requests per minute across all `/auth` routes; the 11th returns 429. The counter is in memory, so every API process keeps its own.
- **Errors** use the usual `{ code, message }` body: 400 `validation_failed`, 401 `invalid_credentials` / `invalid_refresh_token` / `invalid_token` / `unauthenticated`, 409 `email_taken`, 429 rate limited.

To protect another route, add `@UseGuards(AuthGuard)` and read the caller with `@CurrentUser()` (both from `src/platform/auth`).

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
