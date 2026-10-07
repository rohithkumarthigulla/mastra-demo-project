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

Deploying the api and building the Android and web apps: see [docs/deployment.md](docs/deployment.md).

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

| Endpoint                                             | Body                                                                                                  | Success                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /equipment-categories`                          |                                                                                                       | 200 list                                                                                           |
| `POST /equipment-categories`                         | `code` (`UPPER_SNAKE_CASE`), `displayName`                                                            | 201                                                                                                |
| `GET /manufacturers`                                 |                                                                                                       | 200 list                                                                                           |
| `POST /manufacturers`                                | `name` (unique regardless of case)                                                                    | 201                                                                                                |
| `GET /specification-definitions`                     |                                                                                                       | 200 list                                                                                           |
| `POST /specification-definitions`                    | `code`, `displayName`, `valueType` (`NUMERIC`/`TEXT`), `canonicalUnit`                                | 201                                                                                                |
| `GET /specification-sources`                         |                                                                                                       | 200 list                                                                                           |
| `POST /specification-sources`                        | `sourceType`, `sourceName`, `referenceUrl?`, `documentName?`, `retrievedAt?` (`YYYY-MM-DD`), `notes?` | 201                                                                                                |
| `GET /equipment-models` (search, below)              |                                                                                                       | 200 `{ items, limit, offset, total }`                                                              |
| `GET /equipment-models/:id`                          |                                                                                                       | 200 model with `specifications`                                                                    |
| `POST /equipment-models`                             | `manufacturerId`, `categoryId`, `modelName`, `modelCode?`, `status?`                                  | 201                                                                                                |
| `POST /equipment-models/:id/specifications`          | `definitionCode` plus one value shape (below), `verificationStatus?`, `sourceId?`                     | 201 specification with `normalizedMin/normalizedMax`, `verificationStatus`, `verifiedAt`, `source` |
| `PATCH /equipment-models/:id/specifications/:specId` | any of the value or verification fields; `null` clears one, omitted keeps it                          | 200                                                                                                |

- **Value shapes.** A specification is exactly one of: a single value (`numericValue` + `unit`), a range (`minValue` + `maxValue` + `unit`), text (`textValue`, for `TEXT` definitions), or nothing (value unknown). Mixed or incomplete shapes return 400 `invalid_specification_shape`; negative or non-finite numbers 400 `invalid_specification_value`; `minValue > maxValue` 400 `invalid_specification_range`.
- **Units.** `kg`/`t` (mass), `mm`/`m` (length), `kW`/`hp` (power, 1 hp = 745.7 W), `m3` (volume). A `NUMERIC` definition has a fixed `canonicalUnit`; values can be sent in any unit of the same dimension and are also stored converted to the canonical unit in `normalizedMin`/`normalizedMax` (rounded to 9 decimals), so `6720 mm` on a metre definition gives `6.72`. Other dimensions return 400 `incompatible_unit`. The canonical unit cannot be changed once set.
- **Sources.** Every value can cite where it came from: `sourceType` is one of `MANUFACTURER`, `LICENSED_DATASET`, `APPROVED_PUBLIC_SOURCE`, `INTERNAL_VERIFICATION`, `TEST_FIXTURE`. A source that is still cited cannot be deleted. Unknown `sourceId` returns 404 `source_not_found`.
- **Verification status.** `VERIFIED`, `REVIEW_REQUIRED`, `UNKNOWN` or `DEPRECATED`. When omitted it defaults to `REVIEW_REQUIRED` for a value and `UNKNOWN` for an empty one. Rules (400 on violation):
  - an empty value is always `UNKNOWN`, and `UNKNOWN` always has an empty value (`invalid_verification_status`);
  - `VERIFIED` needs a source (`verification_source_required`) that is not a `TEST_FIXTURE` (`test_fixture_not_verifiable`).
- **`verifiedAt`** is set when a value becomes `VERIFIED` (and refreshed when `VERIFIED` is sent again) and cleared when it leaves `VERIFIED`. On PATCH, changing the value without sending `verificationStatus` resets the status to its default, so an edited value needs re-verifying; changing only the source keeps the status but re-checks the rules.
- **Paging.** `limit` defaults to 50 and may be 1–200; `offset` defaults to 0. Models are sorted by manufacturer, then model name.
- **Search.** `GET /equipment-models` takes filters that are combined with AND:
  - `category` — category code, exact (an unknown code matches nothing);
  - `manufacturer` — manufacturer name, exact regardless of case;
  - `model` — text contained in the model name or model code, regardless of case;
  - `spec=CODE:min|max:VALUE:UNIT` — repeatable (up to 10), e.g. `?category=EXCAVATOR&spec=MAX_DIGGING_DEPTH:min:5:m&spec=OPERATING_WEIGHT:max:25:t`. The value is converted to the definition's canonical unit first, so `:min:5000:mm` equals `:min:5:m`. A range matches when any part of it meets the bound (`4–6 m` matches `min:5:m` and `max:4.5:m`); an `UNKNOWN` (empty) value never matches. An unknown code returns 400 `unknown_specification_code`, a unit of another dimension 400 `incompatible_unit`, a `TEXT` definition 400 `non_numeric_specification`, a malformed filter 400 `validation_failed`;
  - `verificationStatus` — only spec values with this status satisfy the `spec` filters (no effect without them);
  - `status` — model status, default `ACTIVE`.

  `total` counts every match, not just the page. Range filters are served by indexes on `(definition_id, normalized_min)` and `(definition_id, normalized_max)` (migration `0005`).

- **Errors.** 404 `*_not_found` for unknown ids or `definitionCode`; 409 `category_exists`, `manufacturer_exists`, `definition_exists`, `model_exists` (same name for the same manufacturer, regardless of case) and `specification_exists` (one value per definition per model).
- The same rules are enforced by `CHECK` constraints and unique indexes in the database.

`pnpm --filter @ee/api db:seed` loads reference data (6 categories, 8 manufacturers, 10 definitions, 15 models, plus the taxonomy below). It only adds what is missing, so it is safe to run again. The specification values are illustrative round numbers, **not manufacturer data**: they cite a `TEST_FIXTURE` source ("Seed reference data") and are `REVIEW_REQUIRED`, so they can never be marked `VERIFIED`.

Upgrading an existing database (migration `0004`) marks every existing value `REVIEW_REQUIRED` (or `UNKNOWN` when empty) with no source; running the seed afterwards attaches the fixture source to seeded values that have none.

### Equipment taxonomy

What equipment can do and which construction work needs it. A **capability** (`DEEP_EXCAVATION`, `LIFTING`, …) is a named ability and never carries a number — numbers stay in specifications. A **construction task** (`FOUNDATION_EXCAVATION`, …) is a kind of site work. Four kinds of link connect them, each unique per pair (a duplicate returns 409 `link_exists`):

| Link                  | Extra fields                                              |
| --------------------- | --------------------------------------------------------- |
| model → capability    | `verificationStatus`, `verifiedAt`, `source` (provenance) |
| category → capability | `verificationStatus`, `verifiedAt`, `source` (provenance) |
| task → capability     | `importance`: `REQUIRED`, `PREFERRED` or `OPTIONAL`       |
| task → category       | `suitability`: `PRIMARY` or `SECONDARY`                   |

| Endpoint                                                    | Auth  | Body / query                                           |
| ----------------------------------------------------------- | ----- | ------------------------------------------------------ |
| `GET /capabilities`, `GET /capabilities/:code`              | —     |                                                        |
| `POST /capabilities`                                        | ADMIN | `code`, `displayName` (409 `capability_exists`)        |
| `GET /capabilities/:code/equipment-models`                  | —     |                                                        |
| `GET /capabilities/:code/construction-tasks`                | —     | `?importance=`                                         |
| `GET /construction-tasks`, `GET /construction-tasks/:id`    | —     |                                                        |
| `POST /construction-tasks`                                  | ADMIN | `code`, `displayName` (409 `construction_task_exists`) |
| `GET` / `POST /construction-tasks/:id/capabilities`         | ADMIN | `capabilityCode`, `importance`                         |
| `GET` / `POST /construction-tasks/:id/equipment-categories` | ADMIN | `categoryCode`, `suitability`                          |
| `GET` / `POST /equipment-models/:id/capabilities`           | ADMIN | `capabilityCode`, `verificationStatus?`, `sourceId?`   |
| `GET` / `POST /equipment-categories/:id/capabilities`       | ADMIN | `capabilityCode`, `verificationStatus?`, `sourceId?`   |
| `GET /equipment-categories/:id/construction-tasks`          | —     |                                                        |

ADMIN applies to the `POST`s only; every `GET` is public. `GET /equipment-models/:id` also returns the model's `capabilities`.

- **Model and category links are separate facts.** Linking a capability to a category says nothing about its models: `GET /capabilities/:code/equipment-models` returns only models linked directly.
- **Provenance.** A link's `verificationStatus` is `REVIEW_REQUIRED` (default) or `VERIFIED`; it is never `UNKNOWN`. `VERIFIED` needs a source (400 `verification_source_required`) that is not a `TEST_FIXTURE` (400 `test_fixture_not_verifiable`), and sets `verifiedAt`. The database enforces the same rules with checks and a trigger.
- **Importance and suitability** are stored vocabulary only; nothing ranks or recommends with them yet.

The seed adds 11 capabilities, 9 construction tasks and links of all four kinds; model and category links cite the `TEST_FIXTURE` source and stay `REVIEW_REQUIRED`. Tables are created by migration `0006`.

## Listings

A listing is a supplier's offer to rent out one piece of plant (`apps/api/src/modules/equipment-listings`, contracts in `packages/contracts/src/equipment-listing.ts`). It is separate from the knowledge base: the knowledge base describes what a model _is_ and is curated by admins; a listing says who rents one out, where and for how much, and points at a knowledge-base model. A listing has no category of its own — it always shows the category of its model.

Supplier routes need the `SUPPLIER` role (401 signed out, 403 any other role) and a supplier profile (409 `supplier_profile_required`). A supplier only sees their own listings: another supplier's id returns 404 `listing_not_found`, as does a malformed id.

| Endpoint                                 | Body                                                                      | Success                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /supplier/listings`                 | query `status?`, `limit`, `offset`                                        | 200 `{ items, total, limit, offset }`, every status  |
| `POST /supplier/listings`                | `modelId`, `cityGeoId`, `title`, `description`, `location`, `pricePerDay` | 201 listing, `DRAFT`                                 |
| `GET /supplier/listings/:id`             |                                                                           | 200 listing                                          |
| `PATCH /supplier/listings/:id`           | any of the create fields (at least one)                                   | 200 listing                                          |
| `POST /supplier/listings/:id/publish`    |                                                                           | 200 listing, `ACTIVE`                                |
| `POST /supplier/listings/:id/deactivate` |                                                                           | 200 listing, `INACTIVE`                              |
| `GET /equipment-listings`                | query filters (below)                                                     | 200 `{ items, total, limit, offset }`, `ACTIVE` only |
| `GET /equipment-listings/:id`            |                                                                           | 200 listing; 404 unless `ACTIVE`                     |

- **Fields.** `title` 3–120 characters, `description` 10–2000, `location` (free text such as a site or area) 2–160, all trimmed. `pricePerDay` is rupees, more than 0 and at most 1,000,000 with up to 2 decimals. Violations return 400 `validation_failed`.
- **References.** `cityGeoId` must be an enabled city (400 `invalid_city`); `modelId` must be an `ACTIVE` knowledge-base model (400 `invalid_model`).
- **Status.** New listings are `DRAFT`. `publish` moves `DRAFT` or `INACTIVE` to `ACTIVE`; `deactivate` moves `ACTIVE` to `INACTIVE`. Anything else returns 409 `invalid_listing_transition`. Publishing also needs at least one `ACTIVE` machine (see [Fleet](#fleet)). Listings can be edited in any status.
- **A listing** returns `id`, `status`, the fields above, `model` (`id`, `modelName`, `manufacturer`, `category`), `city` (`geoId`, `name`), `supplier` (`id`, `displayName`), `photos` in order, `coverPhotoUrl`, `createdAt` and `updatedAt`.
- **Browse filters**, combined with AND: `city` (geo id), `category` (code), `modelId`, `manufacturer` (manufacturer id), `minPrice`, `maxPrice` (inclusive; `minPrice > maxPrice` is 400) and `q` (text in the title, regardless of case). Results are newest first; `limit` defaults to 20 and may be 1–100.

Tables are created by migration `0008`.

### Photos

Suppliers manage the photos of their own listings (same role, profile and ownership rules as above). The first photo in order is the cover photo.

| Endpoint                                       | Body                                    | Success                          |
| ---------------------------------------------- | --------------------------------------- | -------------------------------- |
| `POST /supplier/listings/:id/media`            | `multipart/form-data`, exactly one file | 201 photo, added last            |
| `DELETE /supplier/listings/:id/media/:mediaId` |                                         | 204; row and file removed        |
| `PUT /supplier/listings/:id/media/order`       | `{ "mediaIds": [...] }`                 | 200 `{ items }` in the new order |
| `GET /equipment-listings/:id/media/:mediaId`   |                                         | 200 image bytes                  |

- **Uploads.** JPEG, PNG and WebP only, judged by the file's content rather than its name or declared type (415 `unsupported_media_type`). At most `LISTING_MEDIA_MAX_BYTES` (default 8 MB, 413 `media_too_large`) per photo and 10 photos per listing (409 `media_limit_reached`).
- **Order.** `mediaIds` must list every current photo of the listing exactly once (400 `invalid_media_order`).
- **Serving.** Photos of `ACTIVE` listings are public. Photos of `DRAFT` or `INACTIVE` listings are only served to the owning supplier (send the bearer token); everyone else gets 404 `media_not_found`.
- **Storage.** Files are kept on local disk under `LISTING_MEDIA_DIR` (default `./storage/listing-media`, relative to `apps/api`, git-ignored) under server-generated names; client filenames are stored for display only. Storage sits behind a small interface (`ListingMediaStorage`) so it can be swapped for cloud storage.

The `listing_media` table is created by migration `0009`.

## Fleet

A listing is the offer; the fleet is the machines behind it (`apps/api/src/modules/fleet`, contracts in `packages/contracts/src/fleet.ts`). A supplier keeps machines in **yards**. Each **machine** (equipment unit) belongs to one of the supplier's listings and one of their yards, and has optional **asset identifiers** (serial, registration and engine number). A machine's model always comes from its listing; it is not stored again.

Routes need the `SUPPLIER` role and a supplier profile, like listings. A supplier only sees their own yards and machines: another supplier's id (or a malformed one) returns 404 `yard_not_found` / `unit_not_found`, and pointing a machine at another supplier's listing or yard returns 404 `listing_not_found` / `yard_not_found`.

| Endpoint                       | Body                                                                      | Success                    |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------- |
| `GET /fleet/yards`             |                                                                           | 200 yards, by name         |
| `POST /fleet/yards`            | `name`, `cityGeoId`, `address`                                            | 201 yard                   |
| `PATCH /fleet/yards/:id`       | any of the create fields (at least one)                                   | 200 yard                   |
| `DELETE /fleet/yards/:id`      |                                                                           | 204                        |
| `GET /fleet/units`             | query `listingId?`, `yardId?`, `status?`                                  | 200 machines, newest first |
| `POST /fleet/units`            | `listingId`, `yardId`, `modelYear`, `condition`, `label?`, `identifiers?` | 201 machine, `ACTIVE`      |
| `GET /fleet/units/:id`         |                                                                           | 200 machine                |
| `PATCH /fleet/units/:id`       | any of `yardId`, `modelYear`, `condition`, `label`, `identifiers` (≥ 1)   | 200 machine                |
| `POST /fleet/units/:id/retire` |                                                                           | 200 machine, `RETIRED`     |

- **Yards.** `name` 1–80 characters, unique per supplier regardless of case (409 `yard_name_taken`); `address` up to 300; `cityGeoId` an enabled city (400 `invalid_city`). A yard with `ACTIVE` machines cannot be deleted (409 `yard_has_active_units`); neither can one that only holds retired machines, which are kept for history (409 `yard_in_use`).
- **Machines.** `modelYear` 1950–2100; `condition` one of `NEW`, `EXCELLENT`, `GOOD`, `FAIR`, `POOR`; `label` up to 80 (`null` clears it). A machine's listing cannot change. A machine returns `listing` (`id`, `title`), `model` (with `manufacturer`), `yard` (with `city`), its fields, `status` and `identifiers`.
- **Identifiers.** `{ type, value }` with type `SERIAL_NUMBER`, `REGISTRATION_NUMBER` or `ENGINE_NUMBER` and a value up to 80 characters; at most one of each type per machine. A type + value pair is unique across a supplier's fleet regardless of case (409 `duplicate_identifier`); different suppliers may reuse it. Sending `identifiers` on update replaces the whole set.
- **Retiring.** Retired machines are kept but cannot be edited, retired again (409 `unit_retired`) or blocked, and never count as available.
- **Publishing.** A listing needs at least one `ACTIVE` machine to be published (409 `listing_has_no_active_units`). Retiring a published listing's last machine does not unpublish it; it just shows no availability.

Tables are created by migration `0010`.

## Availability

Suppliers block machines out of service; anyone can ask how many machines of a listing are free (`apps/api/src/modules/availability`, contracts in `packages/contracts/src/availability.ts`). A machine is **available** for a time range when it is `ACTIVE` and no `ACTIVE` block overlaps the range. Bookings will plug into the same rule.

All ranges are half-open, `[start, end)`: a block ending at 10:00 does not overlap one starting at 10:00. Times are ISO 8601 with an offset (`Z` or `+05:30`) and are returned in UTC.

| Endpoint                                   | Body / query                          | Success                                             |
| ------------------------------------------ | ------------------------------------- | --------------------------------------------------- |
| `POST /availability/units/:unitId/blocks`  | `reason`, `startAt`, `endAt`, `note?` | 201 block, `ACTIVE`                                 |
| `DELETE /availability/blocks/:blockId`     |                                       | 200 block, `LIFTED`                                 |
| `GET /availability/units/:unitId`          | query `from`, `to`                    | 200 calendar for one machine                        |
| `GET /availability/fleet`                  | query `from`, `to`                    | 200 `{ from, to, lanes }`, one per `ACTIVE` machine |
| `GET /equipment-listings/:id/availability` | query `from`, `to`                    | 200 `{ totalUnits, availableUnits }`                |

- **Blocks.** `reason` is `MAINTENANCE`, `TRANSPORT` or `HELD_BACK`; `note` up to 500 characters. `endAt` must be after `startAt` (400 `validation_failed`) and `startAt` cannot be in the past (400 `block_in_past`). Retired machines cannot be blocked (409 `unit_retired`).
- **No double blocking.** Overlapping `ACTIVE` blocks on one machine return 409 `block_overlap`. This is enforced by a Postgres exclusion constraint (`btree_gist`), so two requests racing for the same time cannot both win.
- **Lifting** marks a block `LIFTED` and frees the time; the row is kept for history. Lifting twice returns 409 `block_already_lifted`.
- **Calendars** list every `ACTIVE` block overlapping `[from, to)` as a slot `{ state: "BLOCKED", startAt, endAt, source: { type: "BLOCK", id }, reason, note }`, with the block's real times even when it crosses the range edge. `from`/`to` are required, `to` must be after `from`, and a range is at most 92 days (400 `validation_failed`).
- **Supplier routes** follow the fleet rules: another supplier's machine or block returns 404 `unit_not_found` / `block_not_found`.
- **Public availability** needs no sign-in and only exposes counts: `totalUnits` is the listing's `ACTIVE` machines and `availableUnits` those free for the whole range. Listings that are not `ACTIVE` return 404 `listing_not_found`.

The `maintenance_blocks` table is created by migration `0011`.

## Reference data

`GET /public/reference` is unauthenticated and returns `{ cities, entityTypes }` with `Cache-Control: public, max-age=300`, for sign-up forms and city pickers.

- **Cities** (`geoId`, `name`, `state`, `enabled`), ordered by name. `geoId` is a stable code such as `IN-HYD`. `enabled` marks where the marketplace operates.
- **Entity types** (`code`, `name`), ordered by code: Indian business forms such as `SOLE_PROPRIETORSHIP`, `LLP` and `PRIVATE_LIMITED`.

The seed inserts 16 Indian cities (Hyderabad, Bengaluru, Mumbai, Delhi, Chennai and Pune are enabled) and 5 entity types. It only inserts what is missing, so it never overwrites a city enabled since. Tables are created by migration `0007`.

## Money

Every amount is in rupees with at most two decimals: typed, sent, stored (`numeric(14,2)`) and shown the same way.

- `@ee/contracts` (`packages/contracts/src/money.ts`): `roundRupees(value)` rounds to paise, half away from zero, without float errors (`roundRupees(1.005) === 1.01`, `roundRupees(0.1 + 0.2) === 0.3`). `rupeesSchema` takes non-negative amounts with at most two decimals, so `1.005` is rejected. `rateSchema` adds a ceiling of 1,000,000. `signedRupeesSchema` allows negatives.
- `apps/api/src/platform/money.ts`: `readNumeric` parses a `numeric` column (a string from pg) into a number. `toNumericString` formats an amount for writing. `addRupees` and `multiplyRupees` round after every step.

No table stores money yet.

## Client

The Expo app (`apps/client`) signs people in and sends them to the area for their role.

- **API URL.** Set `EXPO_PUBLIC_API_URL` (for example `http://192.168.1.20:3000` for a phone on your network). Without it the client uses `http://localhost:3000`, or `http://10.0.2.2:3000` on the Android emulator. For the browser, add the web origin to the api's `CORS_ORIGINS` (Expo web runs on `http://localhost:8081`).
- **Tokens.** On web the access token lives only in memory and the refresh token is the api's `httpOnly` cookie, so nothing is readable from script. On iOS and Android the refresh token is kept in `expo-secure-store`. On start the app calls `POST /auth/refresh` to restore the session.
- **Expired tokens.** The api client (`api/client.ts`) retries a request once after a 401 by refreshing. Concurrent 401s share one refresh, because each refresh rotates the token. If the refresh itself is rejected the user is signed out.
- **Routing.** `features/auth/routing.ts` decides every redirect: signed-out users go to `/sign-in`, builders to `/home`, suppliers to `/supplier`, and suppliers without a company profile to `/onboarding` until they create one. Each role is kept out of the other's area. `ADMIN` accounts are signed out with a notice for now.

### Screens

| Route                                      | Who      | What                                                                                                                   |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/supplier/company`                        | supplier | edit the company display name                                                                                          |
| `/supplier/fleet/listings`                 | supplier | own listings with a status filter                                                                                      |
| `/supplier/fleet/listings/new`, `.../[id]` | supplier | create and edit a listing (model and city pickers), publish/deactivate, and add, reorder, set cover and delete photos  |
| `/find`                                    | builder  | active listings, newest first, filtered by city, category, manufacturer, price range and text; filters live in the URL |
| `/equipment`                               | builder  | equipment models by category and manufacturer                                                                          |
| `/listing/[id]`, `/equipment/[id]`         | both     | listing detail with photos and model specifications; model detail with its active listings                             |

- **Data.** Screens fetch with TanStack Query; after any create, edit, publish, deactivate or photo change the listing queries are invalidated so lists refresh by themselves.
- **Validation.** The listing form is checked against the shared contract before any request, and per-field api errors are shown under the field. Api messages (for example a 409 on publish) are shown as-is.
- **Photos.** Picked with `expo-image-picker` (photo library on iOS/Android, file picker on web). Each photo is checked for type, size (`MAX_LISTING_PHOTO_BYTES`, 8 MB, kept in step with the api's `LISTING_MEDIA_MAX_BYTES`) and the 10-photo limit, then uploaded one at a time so one bad photo doesn't stop the rest. Photos of draft and inactive listings are only served to the owner, so `AuthImage` sends the access token (a header on native, a fetched blob on web).
- **Specifications.** Values are shown with their unit and marked verified or unverified; anything unknown shows "Not known", never a zero or a guess.
- **Prices.** Shown in rupees with Indian digit grouping, e.g. `₹1,00,000.00`.
- **Layout.** Screens adapt between phone and wide (≥ 768 px) layouts and follow the light/dark theme.

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
