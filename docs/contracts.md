# Feature contracts

This document covers the request and response shapes, tables, statuses and business
rules for the remaining marketplace features. Shapes live in `@ee/contracts`
(`packages/contracts/src`), tables in `apps/api/src/platform/database/schema.ts`
(migration `0012_remaining_features`), and typed client calls and hooks in
`apps/client/api`.

Every route listed here is registered with its role guard and validation, but returns
**501** `{ "code": "NOT_IMPLEMENTED", "message": "…" }` until a later issue implements
it. `packages/contracts/src/routes.ts` (`featureRoutes`) is the single list of routes.
Both the API route test and the client endpoint test check against it.

## General rules

- **Money** is rupees, stored as `numeric(14,2)` and validated with `rupeesSchema` /
  `rateSchema` (at most 2 decimals, rates capped at ₹10,00,000).
- **Ids** are UUIDs. A malformed `:id` returns 404, as elsewhere in the API.
- **Timestamps** are ISO strings with a time zone.
- **Rental dates** are calendar dates (`YYYY-MM-DD`) and include both ends
  (`days = end − start + 1`). The end date cannot be before the start date, the start
  date cannot be in the past (today is taken in `Asia/Kolkata`), and a rental is at
  most 365 days (`withRentalDateRules`).
- **Booking ranges** are stored as `start_at` = midnight at the start of the start date
  and `end_at` = midnight at the start of the day after the end date, both in
  `Asia/Kolkata`. That makes them half-open `[start_at, end_at)` ranges, the same as
  maintenance blocks.
- **Lists** take `limit` (1–100, default 20) and `offset` (default 0), and return
  `{ items, total, limit, offset }`.
- **Responses for a guarded route:** signed out → 401, wrong role → 403, invalid body or
  query → 400 `validation_failed`, otherwise 501 until the route is implemented.

Roles: **B** = `BUILDER`, **S** = `SUPPLIER`, **B/S** = either, but only the two parties
to the record. **Signed in** = any account.

## 1. Rental requests

A builder asks to rent a specific listing for some dates. Contract:
`rental-request.ts`. Table: `rental_requests`.

| Status      | Meaning                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `PENDING`   | Waiting for the supplier to quote or decline.                            |
| `ACCEPTED`  | The builder accepted a quote on it, and a booking exists.                |
| `REJECTED`  | The supplier declined it (optional `declineReason`).                     |
| `CANCELLED` | The builder cancelled it.                                                |
| `WITHDRAWN` | Closed by the system because another invitation for its requirement won. |

| From      | To          | Triggered by                                                                         |
| --------- | ----------- | ------------------------------------------------------------------------------------ |
| `PENDING` | `ACCEPTED`  | Builder accepts a `SENT` quote on this request                                       |
| `PENDING` | `REJECTED`  | Supplier `POST /:id/reject`                                                          |
| `PENDING` | `CANCELLED` | Builder `POST /:id/cancel`                                                           |
| `PENDING` | `WITHDRAWN` | A sibling invitation of the requirement is accepted, or the requirement is cancelled |

| Method | Path                          | Role | Body / query                                  |
| ------ | ----------------------------- | ---- | --------------------------------------------- |
| POST   | `/rental-requests`            | B    | `{ listingId, startDate, endDate, message? }` |
| GET    | `/rental-requests/mine`       | B    | `status?`, paging                             |
| POST   | `/rental-requests/:id/cancel` | B    |                                               |
| GET    | `/rental-requests/incoming`   | S    | `status?`, `listingId?`, paging               |
| POST   | `/rental-requests/:id/viewed` | S    |                                               |
| POST   | `/rental-requests/:id/reject` | S    | `{ reason? }` (≤ 500)                         |
| GET    | `/rental-requests/:id`        | B/S  |                                               |

Rules:

- Only an `ACTIVE` listing can be requested. The message is at most 1000 characters.
- `viewed` sets `viewedAt` the first time only; later calls change nothing. The first
  view of an invitation notifies the builder (`JOB_VIEWED`).
- Only `PENDING` requests can be cancelled or rejected.
- Responses include the listing summary, both display names, and the latest quote
  summary (`{ id, status, total }`) or `null`. Builders never see a quote that is not
  yet sent.

## 2. Rate cards

A supplier's standing prices for a listing beyond the day rate. Quotes are pre-filled
from it. Contract: `rate-card.ts`. Table: `rate_cards` (one row per listing).

There are no statuses. Every amount (`weekRate`, `monthRate`, `transportFee`,
`operatorRatePerDay`, `depositAmount`) is nullable.

| Method | Path                               | Role | Body                           |
| ------ | ---------------------------------- | ---- | ------------------------------ |
| GET    | `/supplier/listings/:id/rate-card` | S    |                                |
| PUT    | `/supplier/listings/:id/rate-card` | S    | every amount, `null` clears it |

Rules:

- Only the listing's supplier can read or write the card.
- `PUT` replaces the whole card. A listing without a card returns every amount as
  `null` and `updatedAt: null` (not a 404).

## 3. Quotes

The supplier's priced offer on a rental request. Contract: `quote.ts`. Tables: `quotes`,
`quote_lines`. Constants: `QUOTE_TAX_PERCENT = 18`, `QUOTE_MAX_LINES = 20`.

| Status             | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `DRAFT`            | Created by the supplier and still editable.                                |
| `PENDING_APPROVAL` | Auto-drafted by the system and waiting for the supplier to review it.      |
| `SENT`             | Sent to the builder. It is now locked.                                     |
| `ACCEPTED`         | The builder accepted it, and a booking was created.                        |
| `REJECTED`         | The builder rejected it (optional reason).                                 |
| `EXPIRED`          | Closed without a decision: past `validUntil`, or a sibling invitation won. |

| From                                | To                 | Triggered by                                     |
| ----------------------------------- | ------------------ | ------------------------------------------------ |
| —                                   | `DRAFT`            | Supplier `POST /quotes`                          |
| —                                   | `PENDING_APPROVAL` | System auto-draft                                |
| `DRAFT`, `PENDING_APPROVAL`         | `SENT`             | Supplier `POST /:id/send`                        |
| `SENT`                              | `ACCEPTED`         | Builder `POST /:id/accept`                       |
| `SENT`                              | `REJECTED`         | Builder `POST /:id/reject`                       |
| `DRAFT`, `PENDING_APPROVAL`, `SENT` | `EXPIRED`          | `validUntil` passes, or the request is withdrawn |

| Method | Path                 | Role | Body / query                                                          |
| ------ | -------------------- | ---- | --------------------------------------------------------------------- |
| POST   | `/quotes`            | S    | `{ rentalRequestId, equipmentUnitId?, lines[], notes?, validUntil? }` |
| GET    | `/quotes/supplier`   | S    | `status?`, paging                                                     |
| PATCH  | `/quotes/:id`        | S    | any of `equipmentUnitId`, `lines`, `notes`, `validUntil`              |
| POST   | `/quotes/:id/send`   | S    |                                                                       |
| GET    | `/quotes/builder`    | B    | `status?`, paging                                                     |
| POST   | `/quotes/:id/accept` | B    |                                                                       |
| POST   | `/quotes/:id/reject` | B    | `{ reason? }`                                                         |
| GET    | `/quotes/:id`        | B/S  |                                                                       |

Totals (calculated by the server; clients never send them):

- A line's `amount` = `quantity × unitAmount`. `unitAmount` is always positive, and a
  `DISCOUNT` line's amount is negative.
- `subtotal` = the sum of every line amount except `DEPOSIT`.
- `taxAmount` = 18% of `subtotal`. The deposit is never taxed.
- `depositAmount` = the sum of the `DEPOSIT` lines.
- `total` = `subtotal + taxAmount + depositAmount`.

Rules:

- **A quote is locked once `SENT`.** `PATCH` only works on `DRAFT` or
  `PENDING_APPROVAL` quotes.
- **An auto-drafted quote starts as `PENDING_APPROVAL` and the builder never sees it
  until it is sent.** `GET /quotes/builder` and builder-side summaries only show `SENT`
  quotes and later.
- A rental request has at most one quote that is not `REJECTED` or `EXPIRED` (partial
  unique index `quotes_one_open_per_request`). Only a `PENDING` request can be quoted.
- `equipmentUnitId` may be null while drafting but must be set before sending, and the
  unit must be free for the request's dates.
- **Accepting a `SENT` quote creates a `CONFIRMED` booking in the same transaction and
  sets the rental request to `ACCEPTED`.** The quote moves to `ACCEPTED` and its
  response carries `bookingId`.
- **If the request belongs to a requirement, accepting also sets the requirement to
  `AWARDED` (with `awardedQuoteId`), sets its other `PENDING` requests to `WITHDRAWN`,
  and expires their open quotes.** This happens in the same transaction.
- Sending notifies the builder (`QUOTE_RECEIVED`). Accepting notifies the supplier
  (`QUOTE_ACCEPTED`) and the builder (`BOOKING_CONFIRMED`). Losing suppliers get
  `QUOTE_LOST`.

## 4. Bookings

A confirmed rental of one machine (unit). Contract: `booking.ts`. Table: `bookings`
(one per quote).

| Status             | Meaning                                           |
| ------------------ | ------------------------------------------------- |
| `CONFIRMED`        | Created from an accepted quote.                   |
| `OUT_FOR_DELIVERY` | The supplier dispatched the machine.              |
| `ON_RENT`          | The machine is on site and the rent has started.  |
| `RETURNED`         | The machine is back. This is final.               |
| `CANCELLED`        | Cancelled before the rent started. This is final. |

| From                            | To                 | Triggered by                    |
| ------------------------------- | ------------------ | ------------------------------- |
| `CONFIRMED`                     | `OUT_FOR_DELIVERY` | Supplier `POST /:id/dispatch`   |
| `OUT_FOR_DELIVERY`              | `ON_RENT`          | Supplier `POST /:id/start-rent` |
| `ON_RENT`                       | `RETURNED`         | Supplier `POST /:id/complete`   |
| `CONFIRMED`, `OUT_FOR_DELIVERY` | `CANCELLED`        | Either party `POST /:id/cancel` |

| Method | Path                       | Role | Body / query         |
| ------ | -------------------------- | ---- | -------------------- |
| GET    | `/bookings/supplier`       | S    | `status?`, paging    |
| GET    | `/bookings/builder`        | B    | `status?`, paging    |
| GET    | `/bookings/:id`            | B/S  |                      |
| POST   | `/bookings/:id/dispatch`   | S    |                      |
| POST   | `/bookings/:id/start-rent` | S    |                      |
| POST   | `/bookings/:id/complete`   | S    |                      |
| POST   | `/bookings/:id/cancel`     | B/S  | `{ reason }` (1–500) |

Rules:

- **Booking changes go `CONFIRMED` → `OUT_FOR_DELIVERY` → `ON_RENT` → `RETURNED`.
  Cancelling is only allowed from `CONFIRMED` or `OUT_FOR_DELIVERY`.** Each step sets
  its timestamp (`dispatchedAt`, `rentStartedAt`, `returnedAt`, `cancelledAt`).
- `CONFIRMED`, `OUT_FOR_DELIVERY` and `ON_RENT` are active (`ACTIVE_BOOKING_STATUSES`).
  The database rejects two active bookings on the same unit with overlapping
  `[start_at, end_at)` (exclusion constraint `bookings_no_overlap`).
- **A machine is unavailable for dates covered by an active maintenance block or an
  active booking.** The availability calendar shows a booking as a slot with
  `state: 'BOOKED'` and `source: { type: 'BOOKING', id }`, next to blocks
  (`state: 'BLOCKED'`, `source: { type: 'BLOCK', … }`).

## 5. Requirements

A builder's job (for example "an excavator in Hyderabad for two weeks") sent to several
suppliers at once. Contract: `requirement.ts`. Table: `requirements`. Constant:
`REQUIREMENT_MAX_SUPPLIERS = 25`.

| Status      | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `DRAFT`     | Being written and not yet sent. Editable.            |
| `OPEN`      | Sent to at least one supplier and collecting quotes. |
| `AWARDED`   | The builder accepted one invitation's quote. Final.  |
| `CANCELLED` | The builder cancelled it. Final.                     |

| From            | To          | Triggered by                                              |
| --------------- | ----------- | --------------------------------------------------------- |
| `DRAFT`         | `OPEN`      | First `POST /:id/send` that sends at least one invitation |
| `OPEN`          | `AWARDED`   | Builder accepts a quote on one of its invitations         |
| `DRAFT`, `OPEN` | `CANCELLED` | Builder `POST /:id/cancel`                                |

| Method | Path                        | Role | Body / query                                                                                                                   |
| ------ | --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/requirements`             | B    | title, `categoryCode`, `equipmentModelId?`, `constructionTaskCode?`, `cityGeoId`, dates, `quantity`, `budgetPerDay?`, `notes?` |
| GET    | `/requirements`             | B    | `status?`, paging                                                                                                              |
| GET    | `/requirements/:id`         | B    | (with invitations)                                                                                                             |
| PATCH  | `/requirements/:id`         | B    | any create field                                                                                                               |
| GET    | `/requirements/:id/matches` | B    | paging                                                                                                                         |
| POST   | `/requirements/:id/send`    | B    | `{ listingIds[] (1–25, unique), message? }`                                                                                    |
| POST   | `/requirements/:id/cancel`  | B    |                                                                                                                                |

Rules:

- `PATCH` only works while the requirement is `DRAFT`, and the date rules are checked
  again.
- `matches` returns active listings in the requirement's city and category that have a
  free unit for the dates, with `alreadyInvited` flagged.
- An **invitation** is a rental request with this requirement's id; there is at most one
  per listing. `send` creates one `PENDING` rental request per listing and returns
  `{ sent: [...], skipped: [{ listingId, reason }] }`, where the reason is:
  - `ALREADY_INVITED`: the listing already has an invitation for this requirement;
  - `NOT_ACTIVE`: the listing is not `ACTIVE`;
  - `UNAVAILABLE`: no unit on the listing is free for the dates.
- A requirement has at most 25 invitations in total. Each one notifies its supplier
  (`REQUEST_RECEIVED`).
- On award, see the quote acceptance rules (§3). Cancelling withdraws every `PENDING`
  invitation, expires their open quotes, and notifies the suppliers
  (`REQUEST_WITHDRAWN`).

## 6. Notifications

In-app messages for one account. Contract: `notification.ts`. Table: `notifications`
(index on account and created at).

| Kind                | For      | When                                                               |
| ------------------- | -------- | ------------------------------------------------------------------ |
| `QUOTE_RECEIVED`    | builder  | A supplier sent a quote.                                           |
| `JOB_VIEWED`        | builder  | A supplier opened the request or invitation for the first time.    |
| `REQUEST_DECLINED`  | builder  | A supplier rejected the request.                                   |
| `BOOKING_CONFIRMED` | builder  | Accepting a quote created a booking.                               |
| `REQUEST_RECEIVED`  | supplier | A new request or invitation arrived.                               |
| `QUOTE_ACCEPTED`    | supplier | The builder accepted their quote.                                  |
| `QUOTE_LOST`        | supplier | The builder accepted another supplier's quote for the requirement. |
| `REQUEST_WITHDRAWN` | supplier | The builder cancelled, or the requirement was awarded elsewhere.   |

Tone is `good`, `waiting` or `neutral`. A notification is either unread or read
(`readAt` set). Reading cannot be undone.

| Method | Path                      | Role      | Query                 |
| ------ | ------------------------- | --------- | --------------------- |
| GET    | `/notifications`          | signed in | `unreadOnly?`, paging |
| POST   | `/notifications/:id/read` | signed in |                       |
| POST   | `/notifications/read-all` | signed in |                       |

Rules:

- Each account only sees its own notifications. The list is newest first and includes
  `unreadCount`.
- `href` is an in-app path starting with `/`, or `null`.
- `read-all` returns `{ updated }`. Marking a notification that is already read
  changes nothing.

## 7. Builder equipment assistant

A chat that helps a builder choose equipment. Contract: `equipment-assistant.ts`.
Tables: `assistant_conversations`, `assistant_messages` (role `USER` or `ASSISTANT`).

There are no statuses; conversations only grow.

| Method | Path                                              | Role | Body                   |
| ------ | ------------------------------------------------- | ---- | ---------------------- |
| POST   | `/equipment-assistant/conversations`              | B    | `{ title? }`           |
| GET    | `/equipment-assistant/conversations`              | B    | paging                 |
| GET    | `/equipment-assistant/conversations/:id`          | B    | (with messages)        |
| POST   | `/equipment-assistant/conversations/:id/messages` | B    | `{ content }` (≤ 4000) |

Rules:

- A builder only sees their own conversations.
- The reply is `{ message, recommendations[], draftRequirement }`. Each recommendation
  has the model id, the model and manufacturer names, a reason, and the number of
  matching `ACTIVE` listings. `draftRequirement` is either `null` or a pre-filled
  `POST /requirements` body for the builder to review. The assistant never creates or
  sends a requirement itself.
- Recommended model ids are stored on the assistant message.

## 8. Supplier agent

A chat that answers a supplier's questions from a knowledge base and proposes changes
for them to confirm. Contract: `supplier-agent.ts`. Tables: `knowledge_documents`,
`knowledge_chunks` (`embedding vector(768)`, HNSW cosine index), `agent_conversations`,
`agent_messages`, `agent_pending_actions` (jsonb payload).

Action types: `BLOCK_UNIT`, `LIFT_BLOCK`, `UPDATE_LISTING_PRICE`, `REJECT_REQUEST`.

| Pending action status | Meaning                                               |
| --------------------- | ----------------------------------------------------- |
| `PENDING`             | Proposed by the agent and waiting for the supplier.   |
| `CONFIRMED`           | The supplier confirmed it and the change was applied. |
| `CANCELLED`           | The supplier declined it.                             |
| `EXPIRED`             | Not answered before `expiresAt`.                      |

| From      | To          | Triggered by                         |
| --------- | ----------- | ------------------------------------ |
| `PENDING` | `CONFIRMED` | Supplier `POST /actions/:id/confirm` |
| `PENDING` | `CANCELLED` | Supplier `POST /actions/:id/cancel`  |
| `PENDING` | `EXPIRED`   | `expiresAt` passes                   |

| Method | Path                                         | Role | Body                                      |
| ------ | -------------------------------------------- | ---- | ----------------------------------------- |
| POST   | `/supplier-agent/conversations`              | S    | `{ title? }`                              |
| GET    | `/supplier-agent/conversations`              | S    | paging                                    |
| GET    | `/supplier-agent/conversations/:id`          | S    | (with messages and pending actions)       |
| POST   | `/supplier-agent/conversations/:id/messages` | S    | `{ content, language?, spokenLanguage? }` |
| GET    | `/supplier-agent/conversations/:id/progress` | S    | → `{ activity }`                          |
| POST   | `/supplier-agent/actions/:id/confirm`        | S    |                                           |
| POST   | `/supplier-agent/actions/:id/cancel`         | S    |                                           |
| GET    | `/supplier-agent/speech`                     | S    | → `{ enabled }`                           |
| POST   | `/supplier-agent/speech/transcribe`          | S    | multipart `file`; `?language=`            |
| GET    | `/supplier-agent/speech/audio`               | S    | `?text=&language=` → WAV                  |

Rules:

- **The supplier agent never changes data without a confirmed pending action.** A reply
  can propose at most one `pendingAction` (`{ id, type, status, summary, expiresAt }`).
  The change runs only on `confirm`, with the same rules as the matching endpoint (for
  example, `REJECT_REQUEST` follows §1, and `BLOCK_UNIT` follows the availability
  rules).
- Only `PENDING`, unexpired actions in the supplier's own conversations can be
  confirmed or cancelled.
- Languages: `en`, `hi`, `mr`, `te`, `ta`, `kn`, `ml`, `bn`. The reply language is the
  spoken language, else the script of the message (the picked language wins within the
  same script), else the picked language; see `resolveReplyLanguage`.
- The reply is `{ message, citations[], pendingAction, language }`. Citations are the
  `{ documentId, title, topic }` of the knowledge documents used, and the cited ids are
  stored on the message.
- Embeddings have 768 dimensions (`KNOWLEDGE_EMBEDDING_DIMENSIONS`). Document `path` is
  unique, and `content_hash` lets re-ingestion skip unchanged files.
