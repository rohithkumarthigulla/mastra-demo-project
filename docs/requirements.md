# Requirements and notifications

How the api implements builder requirements, supplier fan-out and in-app notifications. The wire format is in `packages/contracts/src/requirement.ts` and `packages/contracts/src/notification.ts`; this page covers behaviour.

Code: `apps/api/src/modules/requirements` and `apps/api/src/modules/notifications`.

## Requirements

A builder describes what they need (category, optional model and task, city, dates, quantity, budget). Only the owning builder can see a requirement; any other id returns `404 requirement_not_found`. Suppliers get `403`.

| Status      | Reached by                                         | Allowed next           |
| ----------- | -------------------------------------------------- | ---------------------- |
| `DRAFT`     | `POST /requirements`                               | `OPEN`, `CANCELLED`    |
| `OPEN`      | first `POST /requirements/:id/send` that sends ≥ 1 | `AWARDED`, `CANCELLED` |
| `AWARDED`   | builder accepts a quote (quotes module)            | —                      |
| `CANCELLED` | `POST /requirements/:id/cancel`                    | —                      |

- `PATCH /requirements/:id` works only while `DRAFT` (`409 requirement_not_draft` otherwise). Rental date rules are checked again against the merged dates. If the model changes, it must belong to the requirement's category.
- Unknown or disabled categories, models, tasks and cities return `400` with an `invalid_*` code.

### Matches

`GET /requirements/:id/matches` works while the requirement is `DRAFT` or `OPEN` (`409 requirement_closed` otherwise). It lists `ACTIVE` listings in the requirement's city and category (and model, if one is set), cheapest first. For each listing it returns:

- `availableUnits`: `ACTIVE` units with no active maintenance block and no active booking (`CONFIRMED`, `OUT_FOR_DELIVERY`, `ON_RENT`) overlapping the rental range. The range runs from midnight Asia/Kolkata on the start date up to, but not including, midnight after the end date, the same convention bookings and blocks use.
- `alreadyInvited`: whether this requirement already has an invitation for the listing.

### Send (fan-out)

`POST /requirements/:id/send` creates one `PENDING` rental request (an invitation) per listing. It runs in one transaction, with the requirement row locked so concurrent sends can't go over the limit:

1. Each listing id is classified. `ALREADY_INVITED`, `NOT_ACTIVE` (unknown ids are treated the same way) and `UNAVAILABLE` (no free unit in the range) are returned in `skipped` with their reason.
2. If the remaining listings would push the requirement past `REQUIREMENT_MAX_SUPPLIERS` (25) invitations, the whole call fails with `409 supplier_limit_exceeded` and nothing is written.
3. Invitations are inserted. The partial unique index on `(requirement_id, listing_id)` acts as a final guard.
4. A `DRAFT` requirement becomes `OPEN` and gets `sentAt`.
5. Each supplier gets a `REQUEST_RECEIVED` notification, written in the same transaction.

### Cancel

`POST /requirements/:id/cancel` on a `DRAFT` or `OPEN` requirement does all of the following in one transaction:

- sets the requirement to `CANCELLED`
- sets `PENDING` invitations to `WITHDRAWN`
- sets open quotes (`DRAFT`, `PENDING_APPROVAL`, `SENT`) on those invitations to `EXPIRED`
- sends `REQUEST_WITHDRAWN` to each affected supplier

`AWARDED` returns `409 requirement_awarded`. Cancelling twice returns `409 requirement_closed`.

## Notifications

- `GET /notifications` returns the caller's notifications, newest first. `unreadCount` counts every unread notification on the account, not just the current page. Use `unreadOnly=true` to filter.
- `POST /notifications/:id/read` is idempotent: the first `readAt` is kept. Another account's id returns `404 notification_not_found`.
- `POST /notifications/read-all` returns `{ updated }`, the number of notifications it changed, so a second call returns `0`.
- Other modules call `NotificationsService.notify(rows, tx?)` to send notifications. Pass the caller's transaction so the notification is saved or rolled back together with the change that caused it.
