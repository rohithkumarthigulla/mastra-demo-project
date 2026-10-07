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
pnpm --filter @ee/api db:seed       # optional: load equipment reference data
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

| Endpoint              | Body                                                          | Success                                                  |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `POST /auth/register` | `email`, `password` (min 8), `displayName`, `role`, `client?` | 201 `{ account, accessToken, expiresIn, refreshToken? }` |
| `POST /auth/login`    | `email`, `password`, `client?`                                | 200, same shape as register                              |
| `POST /auth/refresh`  | `refreshToken?`, `client?`                                    | 200, same shape; the old refresh token stops working     |
| `POST /auth/logout`   | `refreshToken?`, `client?`                                    | 204; revokes the refresh token                           |
| `GET /auth/me`        | header `Authorization: Bearer <accessToken>`                  | 200 `{ id, email, displayName, role, createdAt }`        |

- **Passwords** are hashed with argon2id. Emails are trimmed, lower-cased and unique regardless of case.
- **Access tokens** are HS256 JWTs signed with `JWT_SECRET`. They expire after 15 minutes (`expiresIn: 900`).
- **Refresh tokens** are 32 random bytes and last 30 days. Only their SHA-256 hash is stored. Each refresh rotates the token, so reusing an old one returns 401.
- **Clients.** `client` is `"native"` (default) or `"web"`. Native clients get `refreshToken` in the response body and send it back in the body. Web clients get it in an `httpOnly`, `SameSite=Lax` cookie named `refresh_token` scoped to `/auth`; the cookie is never put in the body. Browsers on another origin must be listed in `CORS_ORIGINS` and send credentials.
- **Rate limit.** Each IP can make 10 requests per minute across all `/auth` routes; the 11th returns 429. The counter is in memory, so every API process keeps its own.
- **Errors** use the usual `{ code, message }` body: 400 `validation_failed`, 401 `invalid_credentials` / `invalid_refresh_token` / `invalid_token` / `unauthenticated`, 409 `email_taken`, 429 rate limited.

To protect another route, add `@UseGuards(AuthGuard)` and read the caller with `@CurrentUser()` (both from `src/platform/auth`).

## Authorization

Every account has one role:

| Role       | Who                       | How it is set                                                             |
| ---------- | ------------------------- | ------------------------------------------------------------------------- |
| `SUPPLIER` | lists and rents out plant | chosen at `POST /auth/register`                                           |
| `BUILDER`  | hires plant               | chosen at `POST /auth/register`; accounts created before roles existed    |
| `ADMIN`    | operators                 | only by an operator in the database; registering with `ADMIN` returns 400 |

- `role` is required on register and is returned on every `account` and by `GET /auth/me`.
- The access token carries the role. The guard trusts the token, so a role change (for example `UPDATE accounts SET role = 'ADMIN' ...`) takes effect after the next `POST /auth/refresh`. `GET /auth/me` reads the database and shows the new role straight away.
- To restrict a route, add `@UseGuards(AuthGuard, RolesGuard)` and `@Roles('SUPPLIER', ...)` on the handler or controller (all from `src/platform/auth`). Signed out returns 401 `unauthenticated`; signed in with another role returns 403 `forbidden`.

### Supplier profile

Each `SUPPLIER` account can have one company profile (`apps/api/src/modules/supplier-profiles`, contracts in `packages/contracts/src/supplier-profile.ts`). All routes need the `SUPPLIER` role.

| Endpoint                  | Body          | Success                                                    | Errors                           |
| ------------------------- | ------------- | ---------------------------------------------------------- | -------------------------------- |
| `GET /supplier-profile`   |               | 200 `{ id, accountId, displayName, createdAt, updatedAt }` | 404 `supplier_profile_not_found` |
| `POST /supplier-profile`  | `displayName` | 201, same shape                                            | 409 `supplier_profile_exists`    |
| `PATCH /supplier-profile` | `displayName` | 200, same shape                                            | 404 `supplier_profile_not_found` |

`displayName` is trimmed and must be 2–120 characters (400 `validation_failed` otherwise). Deleting an account deletes its profile.

## Equipment knowledge base

Reference data about kinds of plant (`apps/api/src/modules/equipment-knowledge`, contracts in `packages/contracts/src/equipment-knowledge.ts`): categories, manufacturers, the models they make, and specifications for each model. Reads are public; every write needs the `ADMIN` role (401 signed out, 403 any other role).

| Endpoint                                             | Body                                                                   | Success                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /equipment-categories`                          |                                                                        | 200 list                                             |
| `POST /equipment-categories`                         | `code` (`UPPER_SNAKE_CASE`), `displayName`                             | 201                                                  |
| `GET /manufacturers`                                 |                                                                        | 200 list                                             |
| `POST /manufacturers`                                | `name` (unique regardless of case)                                     | 201                                                  |
| `GET /specification-definitions`                     |                                                                        | 200 list                                             |
| `POST /specification-definitions`                    | `code`, `displayName`, `valueType` (`NUMERIC`/`TEXT`), `canonicalUnit` | 201                                                  |
| `GET /equipment-models?limit=&offset=`               |                                                                        | 200 `{ items, limit, offset, total }`                |
| `GET /equipment-models/:id`                          |                                                                        | 200 model with `specifications`                      |
| `POST /equipment-models`                             | `manufacturerId`, `categoryId`, `modelName`, `modelCode?`, `status?`   | 201                                                  |
| `POST /equipment-models/:id/specifications`          | `definitionCode` plus one value shape (below)                          | 201 specification with `normalizedMin/normalizedMax` |
| `PATCH /equipment-models/:id/specifications/:specId` | any of the value fields; `null` clears one, omitted keeps it           | 200                                                  |

- **Value shapes.** A specification is exactly one of: a single value (`numericValue` + `unit`), a range (`minValue` + `maxValue` + `unit`), text (`textValue`, for `TEXT` definitions), or nothing (value unknown). Mixed or incomplete shapes return 400 `invalid_specification_shape`; negative or non-finite numbers 400 `invalid_specification_value`; `minValue > maxValue` 400 `invalid_specification_range`.
- **Units.** `kg`/`t` (mass), `mm`/`m` (length), `kW`/`hp` (power, 1 hp = 745.7 W), `m3` (volume). A `NUMERIC` definition has a fixed `canonicalUnit`; values can be sent in any unit of the same dimension and are also stored converted to the canonical unit in `normalizedMin`/`normalizedMax` (rounded to 9 decimals), so `6720 mm` on a metre definition gives `6.72`. Other dimensions return 400 `incompatible_unit`. The canonical unit cannot be changed once set.
- **Paging.** `limit` defaults to 50 and may be 1–200; `offset` defaults to 0. Models are sorted by manufacturer, then model name.
- **Errors.** 404 `*_not_found` for unknown ids or `definitionCode`; 409 `category_exists`, `manufacturer_exists`, `definition_exists`, `model_exists` (same name for the same manufacturer, regardless of case) and `specification_exists` (one value per definition per model).
- The same rules are enforced by `CHECK` constraints and unique indexes in the database.

`pnpm --filter @ee/api db:seed` loads reference data (6 categories, 8 manufacturers, 10 definitions, 15 models). It only adds what is missing, so it is safe to run again. The specification values are illustrative round numbers, **not manufacturer data**.

## Client

The Expo app (`apps/client`) signs people in and sends them to the area for their role.

- **API URL.** Set `EXPO_PUBLIC_API_URL` (for example `http://192.168.1.20:3000` for a phone on your network). Without it the client uses `http://localhost:3000`, or `http://10.0.2.2:3000` on the Android emulator. For the browser, add the web origin to the api's `CORS_ORIGINS` (Expo web runs on `http://localhost:8081`).
- **Tokens.** On web the access token lives only in memory and the refresh token is the api's `httpOnly` cookie, so nothing is readable from script. On iOS and Android the refresh token is kept in `expo-secure-store`. On start the app calls `POST /auth/refresh` to restore the session.
- **Expired tokens.** The api client (`api/client.ts`) retries a request once after a 401 by refreshing. Concurrent 401s share one refresh, because each refresh rotates the token. If the refresh itself is rejected the user is signed out.
- **Routing.** `features/auth/routing.ts` decides every redirect: signed-out users go to `/sign-in`, builders to `/home`, suppliers to `/supplier`, and suppliers without a company profile to `/onboarding` until they create one. Each role is kept out of the other's area. `ADMIN` accounts are signed out with a notice for now.

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
| `pnpm --filter @ee/api db:seed`     | loads equipment knowledge reference data (idempotent)                               |

CI (`.github/workflows/ci.yml`) runs these checks against PostgreSQL on every push and pull request, then smoke-tests `GET /health`.
