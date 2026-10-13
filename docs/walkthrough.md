# Walkthrough

A guided tour of EquipmentExchange using the Hyderabad demo data. Follow it top to bottom; each step says what to do and what you should see. No coding is needed, only a terminal and a browser.

"Day N" below means N days from the day you loaded the demo data.

## 1. Start everything

Run these from the project folder, one at a time. The first time takes a few minutes.

| Step | Command                                         | You should see                                                                          |
| ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1    | `pnpm install`                                  | ends with `Done`                                                                        |
| 2    | `cp apps/api/.env.example apps/api/.env`        | nothing (the file is copied)                                                            |
| 3    | `pnpm db:up`                                    | `Container ...-postgres-1 Healthy`                                                      |
| 4    | `pnpm build`                                    | no errors                                                                               |
| 5    | `pnpm --filter @ee/api db:migrate`              | `migrations applied successfully!`                                                      |
| 6    | `pnpm --filter @ee/api db:seed`                 | three "... seeded. Rows created:" lines                                                 |
| 7    | `pnpm --filter @ee/api demo:hyderabad`          | `Created Hyderabad demo data: 4 listings, 7 machines, ...` and a table of four accounts |
| 8    | `pnpm --filter @ee/api start`                   | the api keeps running; leave this terminal open                                         |
| 9    | in a new terminal: `curl localhost:3000/health` | `{"status":"ok"}`                                                                       |
| 10   | `pnpm --filter @ee/client web`                  | Expo starts; press `w` or open <http://localhost:8081>                                  |

Every demo account uses the password **`DemoPass#2026`**:

| Account                                           | Who                                   |
| ------------------------------------------------- | ------------------------------------- |
| `supplier.deccan@demo.equipmentexchange.local`    | Deccan Earthmovers (supplier)         |
| `supplier.charminar@demo.equipmentexchange.local` | Charminar Cranes & Loaders (supplier) |
| `builder.gachibowli@demo.equipmentexchange.local` | Gachibowli Constructions (builder)    |
| `builder.kukatpally@demo.equipmentexchange.local` | Kukatpally Infra (builder)            |

To switch account, press **Sign out** and sign in again.

## 2. Supplier: Deccan Earthmovers

Sign in as `supplier.deccan@demo.equipmentexchange.local`.

1. **Home.** You land on "Welcome, Deccan Earthmovers" with buttons for Rental requests, Quotes, Availability, My listings and Company profile. A tab bar floats at the bottom of every supplier screen: Home, Pipeline, Bookings, Fleet and Assistant. The highlighted tab follows you into detail screens, so a booking keeps **Bookings** lit.
2. **My listings.** Two `ACTIVE` listings: _CAT 320 excavator with operator option_ (₹12,000.00/day) and _JCB 3CX backhoe loader_ (₹4,500.00/day). Open one: it has two coloured placeholder photos, the model's specifications and its machines.
3. **Rate card.** On the CAT 320 listing, the rate card shows week ₹72,000, month ₹2,70,000, transport ₹6,000, operator ₹1,500/day and deposit ₹25,000. The JCB 3CX has no rate card.
4. **Fleet.** One yard, _Gachibowli Yard_, and four machines grouped by listing: `CAT320 #1`, `CAT320 #2`, `JCB3CX #1`, `JCB3CX #2`.
5. **Block a machine.** Open **Availability**. `JCB3CX #2` is already blocked for maintenance from day 1 to day 3 ("Hydraulic hose replacement"). Try blocking another machine for a free day: the block appears on the calendar. Lift it again to leave the data as it was.
6. **Incoming requests.** Open **Rental requests**. Among them:
   - Gachibowli Constructions wants the CAT 320 from day 7 to day 16 ("Basement excavation for a 12-floor tower"). Its quote is `PENDING_APPROVAL`: the system drafted it from the rate card and is waiting for you.
   - Kukatpally Infra's requirement "Excavator for foundation work, Kukatpally" arrived as a request for the CAT 320 (day 40 to day 45).
7. **Approve a quote.** Open the Gachibowli request, then its quote. The lines come from the rate card (rental, transport, deposit) with 18% tax on everything except the deposit. Press **Send to builder**: the status becomes `SENT` and the quote is read-only.
8. **Quote a request from scratch.** Open the Kukatpally requirement request and create a quote: pick a machine, add a `RENTAL` line, and press **Send to builder**.
9. **Bookings.** Open **Bookings**:
   - Kukatpally Infra, JCB 3CX, day 5 to day 9: `CONFIRMED`. Open it and press **Dispatch**: it becomes `OUT_FOR_DELIVERY`. **Start rent** makes it `ON_RENT`, **Complete** makes it `RETURNED`.
   - Kukatpally Infra, JCB 3CX, day 30 to day 33: already `RETURNED`.
10. **Tracker.** Press **Pipeline**. The board groups open work into columns: New requests, Quote to send, Awaiting builder, Confirmed, Out for delivery, On rent and Returned, with a summary row. Each request or booking you saw above sits in one column.

## 3. Supplier: Charminar Cranes & Loaders

Sign in as `supplier.charminar@demo.equipmentexchange.local`.

1. **My listings.** _Komatsu PC210 excavator_ (₹11,000.00/day, two machines, _Uppal Depot_) and _JCB 540-140 telehandler_ (₹8,000.00/day, one machine).
2. **Rental requests.**
   - Gachibowli Constructions wants the telehandler from day 10 to day 14, with no quote yet (`PENDING`). Opening it marks it viewed. You can create a quote or decline it with a reason.
   - Kukatpally Infra's request for the PC210 (day 20 to day 24) has a `SENT` quote: 5 days × ₹11,000 + ₹5,000 delivery, total **₹70,800.00** with 18% tax, valid until day 7.
   - Kukatpally's requirement also arrived here as a request for the PC210.
3. **Bookings.** Gachibowli Constructions, PC210, day 1 to day 6: `ON_RENT`. **Complete** moves it to `RETURNED`.

## 4. Builder: Kukatpally Infra

Sign in as `builder.kukatpally@demo.equipmentexchange.local`.

1. **Home.** "Welcome, Kukatpally Infra" with Post a requirement, Notifications, Equipment assistant and Equipment catalogue. The Notifications button shows the unread count. A tab bar floats at the bottom of every builder screen: Home, Find, Requests, Requirements and Bookings.
2. **Browse the catalogue.** The **Find** tab lists the four demo listings in Hyderabad (plus any others in your database). Filter by category _Excavator_: only the CAT 320 and PC210 remain. **Equipment catalogue** lists equipment models; open _Caterpillar 320_ to see its specifications and its active listings.
3. **Accept a quote.** **Requests**: the PC210 request (day 20 to day 24) has a `SENT` quote. Open it and press **Accept and book**. The quote becomes `ACCEPTED` and a `CONFIRMED` booking appears under **Bookings**.
4. **See bookings.** **Bookings** lists JCB 3CX day 5 to day 9 (`CONFIRMED`, or later if you moved it as Deccan), JCB 3CX day 30 to day 33 (`RETURNED`) and the PC210 booking you just made.
5. **Track a requirement.** **Requirements**: "Excavator for foundation work, Kukatpally" is `OPEN`. Open it: it was sent to the CAT 320 (Deccan) and PC210 (Charminar) listings. Each row shows whether the supplier has viewed it and any quote they sent (for example the one you sent as Deccan in step 2.8).
6. **Create and send a requirement.** **Post a requirement**: title "Telehandler for slab work", category _Telehandler_, city _Hyderabad_, dates a few weeks out. Save it, open its matches, tick the JCB 540-140 listing and send. It now shows as sent, and Charminar sees a new rental request.
7. **Notifications.** Open **Notifications**: quote received, booking confirmed and similar messages, newest first. Opening one marks it read; **Mark all as read** clears the count.

## 5. Builder: Gachibowli Constructions

Sign in as `builder.gachibowli@demo.equipmentexchange.local`.

1. **My requests.** The telehandler request (day 10 to day 14) has no quote yet. The CAT 320 request (day 7 to day 16) shows its quote once Deccan has sent it (step 2.7).
2. **Send a request.** **Find equipment**, open _JCB 3CX backhoe loader_, press **Request equipment**, choose dates and **Send request**. The request appears in **My requests** as `PENDING`, and in Deccan's **Rental requests**.
3. **Bookings.** PC210 day 1 to day 6, `ON_RENT` (or `RETURNED` if you completed it as Charminar).

## 6. Supplier notifications

The supplier app has no notifications screen yet; suppliers see new work in **Rental requests** and the tracker. The api stores their notifications all the same. To check them, sign in and list them:

```sh
TOKEN=$(curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"supplier.deccan@demo.equipmentexchange.local","password":"DemoPass#2026"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s localhost:3000/notifications -H "authorization: Bearer $TOKEN"
```

You should see "request received" and "quote accepted" entries.

## 7. Assistants

**Without an AI key** (the default): open the assistant as a builder (`/assistant`) or the agent as a supplier (`/supplier/agent`). Sending a message shows "The assistant is not set up on this server". Everything else keeps working.

**With an AI key:** stop the api, set `GEMINI_API_KEY=...` in `apps/api/.env`, run `pnpm --filter @ee/api agent:ingest` once, and start the api again.

- As a builder, ask "Which excavator suits foundation work in black cotton soil?" The assistant answers from the catalogue and links to listings. Demo specifications cite "Demo data (not real manufacturer figures)" and are not treated as verified.
- As Deccan, ask "Block JCB3CX #1 for maintenance next Monday." The agent proposes the change and waits for you to confirm before doing anything.

More detail: [assistants.md](assistants.md).

## 8. Reset

- Start over: `pnpm --filter @ee/api demo:hyderabad --remove`, then `pnpm --filter @ee/api demo:hyderabad`.
- Running `demo:hyderabad` again without `--remove` prints "Demo data already present; nothing changed" and changes nothing, including anything you did during the tour.
- `--remove` deletes only demo accounts and everything they own (listings, photos, requests, quotes, bookings, notifications). Other data is left alone.

## Troubleshooting

| Problem                                                     | Fix                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm db:up` fails or hangs                                 | Start Docker Desktop and run it again. If port 5432 is taken, stop the other PostgreSQL.                   |
| `/health` returns `database_unavailable`                    | The database is not running (`pnpm db:up`) or migrations are missing (`pnpm --filter @ee/api db:migrate`). |
| `demo:hyderabad` says "Seeded model ... not found"          | Run `pnpm --filter @ee/api db:seed` first.                                                                 |
| `demo:hyderabad` says "Refusing to load demo data"          | `NODE_ENV` is `production`. Demo data is for local development; unset it.                                  |
| `Cannot find module .../dist/scripts/demo-hyderabad.js`     | Run `pnpm build` first.                                                                                    |
| Signing in fails with "too many requests"                   | Sign-in is limited to 10 attempts a minute. Wait a minute.                                                 |
| The client shows network errors in the browser              | Make sure the api is running and `CORS_ORIGINS` in `apps/api/.env` includes `http://localhost:8081`.       |
| The client on a phone cannot reach the api                  | Set `EXPO_PUBLIC_API_URL` to your computer's address, e.g. `http://192.168.1.20:3000`.                     |
| Dates in the tour are in the past, or quotes show `EXPIRED` | The demo was loaded on an earlier day. Remove and reload it.                                               |
| A step was already done                                     | You (or someone else) did it earlier on the same data. Remove and reload the demo.                         |
| Photos are broken after moving the project                  | Photos live in `LISTING_MEDIA_DIR` (default `apps/api/storage/listing-media`). Remove and reload the demo. |
