# Rental flow

How a builder rents a machine: **rental request → quote → booking**. Endpoint shapes live in
[`contracts.md`](./contracts.md) and `packages/contracts/src`. This page covers the behaviour
behind them.

```
Builder                         Supplier
  │ POST /rental-requests  ───────▶ REQUEST_RECEIVED      (auto-draft quote, hidden)
  │                        ◀─────── POST /:id/viewed      JOB_VIEWED (first open only)
  │                                 POST /quotes, PATCH /quotes/:id
  │ QUOTE_RECEIVED         ◀─────── POST /quotes/:id/send
  │ POST /quotes/:id/accept ──────▶ QUOTE_ACCEPTED
  │ BOOKING_CONFIRMED               (losing suppliers: QUOTE_LOST)
  │                                 POST /bookings/:id/dispatch → start-rent → complete
```

## Rental requests

```
PENDING ──builder cancel──▶ CANCELLED
   │ ────supplier reject──▶ REJECTED
   │ ────quote accepted───▶ ACCEPTED
   └──── competitor won the requirement ──▶ WITHDRAWN
```

- You can only request an `ACTIVE` listing (otherwise 404). Dates must pass the shared date
  rules, and at least one `ACTIVE` unit must be free for the whole range: no active booking and
  no `ACTIVE` maintenance block. Otherwise you get 409 `no_unit_available`.
- A builder cannot hold two `PENDING` requests for the same listing with overlapping dates
  (409 `duplicate_rental_request`). The listing row is locked during creation, so two parallel
  creates cannot both pass this check.
- Cancelling or rejecting a request also expires its open quote (`DRAFT`, `PENDING_APPROVAL`
  or `SENT`).
- `POST /:id/viewed` stamps `viewedAt` and notifies the builder only once. Repeat calls return
  the request unchanged.
- Only the builder and the listing's supplier can read a request. Anyone else gets 404.

## Quotes

```
DRAFT ─┐
       ├─send─▶ SENT ──accept──▶ ACCEPTED
PENDING_APPROVAL┘    ├─reject──▶ REJECTED
                     └─validUntil passed / request closed / requirement awarded ─▶ EXPIRED
```

### Totals (always computed by the server)

Each line has `amount = quantity × unitAmount`. `DISCOUNT` lines are stored negative.

```
subtotal = Σ amount of every line except DEPOSIT        (discounts reduce it)
tax      = roundRupees(subtotal × 18 / 100)              (QUOTE_TAX_PERCENT)
deposit  = Σ amount of DEPOSIT lines                     (not taxed)
total    = subtotal + tax + deposit
```

Each step is rounded to the paisa, half away from zero (`roundRupees`). If discounts push the
subtotal below zero, the quote is rejected (400 `negative_subtotal`). The request schema is
strict, so a client-sent total is a 400.

### Rules

- One open quote per request. This is enforced by the partial unique index
  `quotes_one_open_per_request`, and a second open quote gets 409 `quote_already_open`.
- Suppliers can edit only `DRAFT` and `PENDING_APPROVAL` quotes. Editing anything else,
  including a `SENT` quote, gets 409 `quote_not_editable`.
- To send, the quote needs exactly one `RENTAL` line, an `equipmentUnitId` on the request's
  listing, a free unit for the dates and a `validUntil` that is not in the past.
- **Auto-draft.** When a request arrives for a listing that has a rate card, the server creates
  a `PENDING_APPROVAL` quote with `autoDrafted: true`. Its lines are:
  - `RENTAL`: days × the cheapest qualifying daily price. The day price always qualifies, the
    week rate ÷ 7 qualifies for 7+ days, and the month rate ÷ 30 for 30+ days.
  - `TRANSPORT` and `DEPOSIT`: added when the card sets them.
  - Operator lines are never added. The first free unit is pre-selected.
- Builders only ever see `SENT`, `ACCEPTED`, `REJECTED` and `EXPIRED` quotes, both in lists
  and in `latestQuote`. A direct `GET` of an unsent quote is 404.
- **Expiry is applied when a quote is read.** A `SENT` quote whose `validUntil` is before today
  in Asia/Kolkata is shown and filtered as `EXPIRED` and cannot be accepted. There is no
  background job and nothing is written to the database.

### Acceptance (one transaction)

1. Lock the quote. It must be the builder's own, effectively `SENT`, and its request must
   still be `PENDING`.
2. Set the quote to `ACCEPTED` and the request to `ACCEPTED`. Insert a `CONFIRMED` booking
   covering `[startDate 00:00, endDate+1 00:00)` in Asia/Kolkata, with the quote's total.
3. If the request belongs to a requirement:
   - set the requirement to `AWARDED` with `awardedQuoteId`
   - set the other `PENDING` requests to `WITHDRAWN` and their open quotes to `EXPIRED`
   - notify those suppliers with `QUOTE_LOST` (if they had a quote) or `REQUEST_WITHDRAWN`
4. Notify the supplier with `QUOTE_ACCEPTED` and the builder with `BOOKING_CONFIRMED`.

The `bookings` EXCLUDE constraint is the final guard against double booking. When two builders
accept overlapping quotes for the same unit, one gets 200 and the other gets 409
`unit_unavailable`, and the losing transaction rolls back completely.

## Bookings

```
CONFIRMED ─dispatch─▶ OUT_FOR_DELIVERY ─start-rent─▶ ON_RENT ─complete─▶ RETURNED
    └──────────cancel (reason)──┴──▶ CANCELLED
```

- Only the supplier can move a booking forward. Either party can cancel it, with a reason of
  1–500 characters. Any other move gets 409 `invalid_booking_transition`.
- Each step records its timestamp: `dispatchedAt`, `rentStartedAt`, `returnedAt` or
  `cancelledAt`.
- Updates are compare-and-set on the current status, so two concurrent changes cannot both
  succeed.
- Only the builder and the supplier can read a booking. Anyone else gets 404.

## Availability

A unit is busy when it has an `ACTIVE` maintenance block or a `CONFIRMED`, `OUT_FOR_DELIVERY`
or `ON_RENT` booking. This affects:

- Unit and fleet calendars, which return `BOOKED` slots (`source.type = 'BOOKING'`) alongside
  `BLOCKED` slots, ordered by start.
- Public listing availability, which leaves booked units out of `availableUnits`.
- Block creation: a block overlapping an active booking gets 409 `block_over_booking`.

Cancelled and returned bookings free the unit.

## Notifications

All are written to `notifications` in the same transaction as the change that caused them.
Each `href` is an in-app path (`/rental-requests/:id` or `/bookings/:id`).

| Kind              | To       | Tone    |
| ----------------- | -------- | ------- |
| REQUEST_RECEIVED  | supplier | waiting |
| JOB_VIEWED        | builder  | neutral |
| REQUEST_DECLINED  | builder  | neutral |
| REQUEST_WITHDRAWN | supplier | neutral |
| QUOTE_RECEIVED    | builder  | waiting |
| QUOTE_ACCEPTED    | supplier | good    |
| BOOKING_CONFIRMED | builder  | good    |
| QUOTE_LOST        | supplier | neutral |

## Assumptions

- Rental days are whole calendar days in Asia/Kolkata (fixed UTC+05:30).
- Rejecting a quote leaves the request `PENDING`, so the supplier can quote again.
- Cancelling a booking does not reopen the request or the quote.
