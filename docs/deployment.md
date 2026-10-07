# Deployment

The api ships as a Docker image built from the repository root. The client is an Expo app: Android builds go through EAS, and the web build is a static export that any static host can serve.

Config files:

| File                   | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `Dockerfile`           | api image (`node:22-slim`, pnpm via corepack)                                            |
| `.dockerignore`        | keeps `node_modules`, build output, `.env` files, `storage/` and `.git` out of the image |
| `railway.toml`         | Railway build, pre-deploy, health check and restart settings                             |
| `apps/client/eas.json` | EAS build profiles (`preview`, `production`)                                             |
| `apps/client/app.json` | app name, ids, version, icon and splash                                                  |

## Environment variables

### api

The api validates these on startup (`apps/api/src/platform/config/env.ts`) and exits with a clear message if one is missing or invalid. The image contains no `.env` file; set them on the host.

| Variable                  | Required | Default                   | Example                                         | Meaning                                                                                  |
| ------------------------- | -------- | ------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | yes      | —                         | `postgres://ee:ee@localhost:5432/ee`            | PostgreSQL connection string; the database needs the `vector` extension                  |
| `JWT_SECRET`              | yes      | —                         | output of `openssl rand -base64 48`             | secret for signing access tokens, at least 32 characters                                 |
| `NODE_ENV`                | no       | `development`             | `production`                                    | `development`, `test` or `production`; `production` marks cookies `Secure`               |
| `PORT`                    | no       | `3000`                    | `8080`                                          | port to listen on; the api always binds `0.0.0.0`                                        |
| `CORS_ORIGINS`            | no       | empty (CORS off)          | `https://app.example.com,http://localhost:8081` | comma-separated origins allowed to call the api from a browser                           |
| `LISTING_MEDIA_DIR`       | no       | `./storage/listing-media` | `/data/listing-media`                           | directory for uploaded listing photos; relative paths resolve from the working directory |
| `LISTING_MEDIA_MAX_BYTES` | no       | `8388608` (8 MB)          | `5242880`                                       | largest accepted listing photo, in bytes                                                 |

The image sets `NODE_ENV=production` and `PORT=3000`; override either on the host.

### client

| Variable              | Required               | Example                   | Meaning                                                                                                                                                           |
| --------------------- | ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | for any deployed build | `https://api.example.com` | api base address, baked into the bundle at build time. Without it the app falls back to `http://localhost:3000` (`http://10.0.2.2:3000` on the Android emulator). |

## Run the container locally

This uses the Docker Compose database (PostgreSQL 17 with pgvector).

```sh
pnpm db:up                                   # PostgreSQL on localhost:5432
docker build -t ee-api .

export JWT_SECRET="$(openssl rand -base64 48)"
DB=postgres://ee:ee@host.docker.internal:5432/ee

# Migrate and seed once, as the Railway pre-deploy step does. Both are safe to re-run.
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL=$DB -e JWT_SECRET \
  ee-api sh -c "pnpm --filter @ee/api db:migrate && pnpm --filter @ee/api db:seed"

docker run --rm -p 3000:3000 --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL=$DB -e JWT_SECRET \
  -e CORS_ORIGINS=http://localhost:8081 \
  -v ee-media:/data/listing-media -e LISTING_MEDIA_DIR=/data/listing-media \
  ee-api

curl http://localhost:3000/health            # {"status":"ok"}
```

`/health` returns 503 `{"code":"database_unavailable",...}` until the database is reachable and migrated.

## Deploy the api to Railway

1. Create a Railway project and add a service from this GitHub repository. Check the service settings match `railway.toml` (see the note below):
   - **Builder:** Dockerfile, path `Dockerfile`.
   - **Pre-deploy command:** `pnpm --filter @ee/api db:migrate && pnpm --filter @ee/api db:seed`. Railway runs it once per deploy, before the new container takes traffic. Migrations and seed are kept out of the start command, so a container restart never re-runs them.
   - **Healthcheck path:** `/health`.
   - **Restart policy:** on failure, up to 10 retries.
2. Add PostgreSQL with pgvector. Railway's standard PostgreSQL does not include the extension, so deploy the pgvector template (or a service from the `pgvector/pgvector:pg17` image) instead. Then run this once against it:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. In the api service's variables, set:
   - `DATABASE_URL`: a reference to the database service's connection URL, e.g. `${{Postgres.DATABASE_URL}}` (use your database service's name).
   - `JWT_SECRET`: a fresh value from `openssl rand -base64 48`. Do not reuse the development value.
   - `CORS_ORIGINS`: the origin of the deployed web client, e.g. `https://app.example.com`. Leave empty if only the Android app calls the api.
4. Add a volume to the api service, mount it at `/data/listing-media` and set `LISTING_MEDIA_DIR=/data/listing-media` (see [Listing photos need a persistent volume](#listing-photos-need-a-persistent-volume)).
5. Generate a public domain under the service's networking settings and deploy. Check `https://<domain>/health` returns `{"status":"ok"}`.

> **`railway.toml` may not be applied.** Railway has deprecated config as code (`railway.toml`) in favour of infrastructure as code (`.railway/railway.ts`). Services created before the change keep reading the file until 2026-12-01. New services ignore it, so set the values in step 1 in the service settings yourself. You can also generate `.railway/railway.ts` from the file with `railway config migrate`.

## Build the Android app with EAS

`apps/client/eas.json` defines two profiles:

| Profile      | Output                                         | Version                              |
| ------------ | ---------------------------------------------- | ------------------------------------ |
| `preview`    | APK for internal distribution (direct install) | as set in EAS                        |
| `production` | store build (AAB)                              | build number auto-incremented by EAS |

Neither profile contains an api address. Each reads `EXPO_PUBLIC_API_URL` from the matching EAS environment.

```sh
npm install -g eas-cli
eas login
cd apps/client
eas init                         # links the project; adds extra.eas.projectId to app.json — commit it

eas env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://<api-domain> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<api-domain> --visibility plaintext

eas build --platform android --profile preview
```

When the build finishes, EAS prints a link to the APK. Open it on the device, or download and install the APK. Use `--profile production` for a store build.

The app's package id is `com.equipmentexchange.app` (iOS bundle id is the same), and its version is set in `app.json` (`1.0.0`).

## Build the web client

`EXPO_PUBLIC_API_URL` is read at build time. Build the contracts package first (the root `pnpm build` does this):

```sh
pnpm --filter @ee/contracts build
EXPO_PUBLIC_API_URL=https://<api-domain> pnpm --filter @ee/client build
```

This writes a static single-page export to `apps/client/dist/`. Serve that folder from any static host, rewriting unknown paths to `index.html`. Add the host's origin to the api's `CORS_ORIGINS`.

## Listing photos need a persistent volume

Uploaded listing photos are stored on the api's local disk, in `LISTING_MEDIA_DIR`. A container's filesystem is wiped on every redeploy, so mount a persistent volume at that path on the host (on Railway, a service volume). Without one, photos disappear after each deploy while their database records remain.
