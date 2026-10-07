# Supplier screens

The supplier side of the client app: fleet, availability, rental requests, quotes,
bookings and the pipeline tracker. Everything here is client-only; it uses the routes in
[contracts.md](contracts.md) and changes nothing on the API.

## Screens

| Route                              | Screen                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `/supplier`                        | Home, with links to every screen below                                         |
| `/supplier/fleet`                  | Yards (add, edit, delete inline) and machines grouped by listing               |
| `/supplier/fleet/units/new`        | Add a machine (`?listingId=` preselects the listing)                           |
| `/supplier/fleet/units/[id]`       | Edit or retire a machine                                                       |
| `/supplier/fleet/listings/[id]`    | Existing listing editor, plus its machines and rate card                       |
| `/supplier/availability`           | Fleet calendar: block days, lift blocks, open bookings                         |
| `/supplier/pipeline`               | Incoming rental requests, filtered by status                                   |
| `/supplier/pipeline/requests/[id]` | Request detail: marked viewed on open, decline, create or open its quote       |
| `/supplier/pipeline/quotes/new`    | Quote builder for a request (`?requestId=`)                                    |
| `/supplier/pipeline/quotes/[id]`   | Quote detail: editable while `DRAFT`/`PENDING_APPROVAL`, read-only once `SENT` |
| `/supplier/quotes`                 | Every quote, filtered by status                                                |
| `/supplier/bookings`               | Bookings, filtered by status                                                   |
| `/supplier/bookings/[id]`          | Booking detail: dispatch, start rent, complete, cancel with a reason           |
| `/supplier/pipeline/tracker`       | Pipeline board: open work by stage, with a summary row                         |

Screen code lives in `apps/client/app/supplier`; components and logic in
`apps/client/features/supplier`.

## Design decisions

- **Fleet and availability calls.** `apps/client/api` has no typed module for
  `/fleet/*` and `/availability/*`. `features/supplier/fleetApi.ts` wraps them with
  `api.request` and the contract schemas, so responses are still validated.
- **Pure logic is separate from screens.** Quote arithmetic (`quoteMath.ts`), quote
  validation (`quoteForm.ts`), tracker mapping (`tracker.ts`), calendar layout
  (`calendarLayout.ts`, `dateRange.ts`), booking steps (`bookingActions.ts`) and the
  fleet, block and rate-card forms are plain functions with tests.
- **Quote preview.** The builder shows a live preview using the same rules as the server
  (see "Totals" in contracts.md): each line rounded with `roundRupees`, deposit untaxed,
  18% GST rounded half away from zero. The server's totals are authoritative and are what
  the read-only view shows.
- **Sending a quote** needs at least one `RENTAL` line and a chosen machine. Saving a draft
  needs neither.
- **Machine choice.** The machine picker lists the listing's active machines and puts
  those free for every day of the request first, using the fleet calendar. Busy machines
  are still offered (marked busy); the server checks again when the quote is sent.
- **Days are IST.** Calendar columns and blocks are whole days in `Asia/Kolkata`. A block
  from 9 to 15 Oct is sent as `[9 Oct 00:00 IST, 16 Oct 00:00 IST)`.
- **Calendar range** defaults to the next 30 days and is capped at 92 (the contract
  maximum). Phones scroll sideways; wide screens show the whole grid.
- **Confirmations** (retire, delete yard, lift block, decline, send, booking steps,
  cancel) use one `ConfirmDialog` with an optional or required reason field.
- **Endpoints that return 501** (requests, quotes, bookings) are treated as the contract.
  Their errors show as "This isn't available yet", and their behaviour is tested against
  sample responses in `fixtures.ts`, validated by the contract schemas.

## Tracker mapping

| Status                                                                                      | Column                             |
| ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Request `PENDING`, no quote                                                                 | New requests                       |
| Request `PENDING`, quote `DRAFT`/`PENDING_APPROVAL`                                         | Quote to send                      |
| Request `PENDING`, quote `SENT`                                                             | Awaiting builder                   |
| Booking `CONFIRMED`                                                                         | Confirmed                          |
| Booking `OUT_FOR_DELIVERY`                                                                  | Out for delivery                   |
| Booking `ON_RENT`                                                                           | On rent                            |
| Booking `RETURNED`                                                                          | Returned                           |
| Request `REJECTED`/`CANCELLED`/`WITHDRAWN`, quote `REJECTED`/`EXPIRED`, booking `CANCELLED` | Off the board, counted as "Closed" |

A request that has a booking is shown once, as the booking. The board loads up to 100
open requests and 100 bookings and says so when there are more.

## Contract gaps

- No typed fleet/availability module in `apps/client/api` (worked around in
  `fleetApi.ts`).
- No "machines free between these dates" endpoint; the quote builder derives it from the
  fleet calendar.
- `BookingDto` has no machine label, so booking screens link to the machine instead of
  naming it.
- The supplier quote list has no request message; open the request to read it.
- No single pipeline endpoint; the tracker combines the request and booking lists.

## Manual test

With the API and database running (`pnpm db:up`, then the API and `pnpm --filter
./apps/client web`), signed in as a supplier with a company profile and a listing:

1. Fleet → add a yard. Add two machines to the listing.
2. Availability → block one machine for a week (Maintenance). It shows as a grey bar.
3. Change the range (14/30/60/92 days, or a new start date); the block stays put.
4. Tap the block → lift it. It disappears.
5. Try blocking a day in the past or overlapping an existing block; the screen explains
   why it can't.
6. Open the listing: its machines and rate card are shown. Retire every machine, then
   try to publish; you're asked to add a machine.
7. Requests, quotes and bookings return "This isn't available yet" until the rental API
   is built; their flows are covered by `supplierFlow.test.ts`.
