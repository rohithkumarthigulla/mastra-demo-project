---
language: en
audience: SUPPLIER
domain: RENTALS
topic: rentals.lifecycle
sourceType: internal
---

# The booking lifecycle

A booking is created when a builder accepts your sent quote. From then on, it moves through a fixed set of statuses until the equipment comes back.

## The statuses

```
CONFIRMED → OUT_FOR_DELIVERY → ON_RENT → RETURNED
```

| Status             | Meaning                                                     |
| ------------------ | ----------------------------------------------------------- |
| `CONFIRMED`        | the rental is agreed; the equipment has not left yet        |
| `OUT_FOR_DELIVERY` | the equipment is on its way to the builder's site           |
| `ON_RENT`          | the equipment is on site and in use                         |
| `RETURNED`         | the equipment is back; the rental is complete               |
| `CANCELLED`        | the booking was cancelled before the equipment went on rent |

## Starting as CONFIRMED

A booking starts as `CONFIRMED` the moment the builder accepts your quote. There is no separate step where you confirm it again. That is why you should only send quotes you are ready to honour, with a machine free for the dates.

## Moving forward

Update the booking as the rental happens:

1. **`CONFIRMED` → `OUT_FOR_DELIVERY`** when the equipment leaves for the site.
2. **`OUT_FOR_DELIVERY` → `ON_RENT`** when it arrives and the rental begins.
3. **`ON_RENT` → `RETURNED`** when the equipment comes back.

Bookings move forward in this order. Keeping the status accurate helps you and the builder see where every rental stands.

## Cancelling

A booking can be cancelled only while it is:

- `CONFIRMED`, or
- `OUT_FOR_DELIVERY`.

Once a booking is `ON_RENT`, it can no longer be cancelled. It continues until the equipment is `RETURNED`. A `RETURNED` booking is complete and cannot be cancelled either.

If you know you cannot fulfil a booking, act early, while it is still `CONFIRMED`.

## Money

The booking follows the quote the builder accepted. That quote was locked when you sent it, so its line items and total do not change. All amounts are in rupees, with at most two decimal places, and include GST at 18%.

## Using the assistant

You can ask the assistant where a booking stands, or ask it to move a booking to its next status. It will describe the change, for example "mark booking 1042 as out for delivery", and ask you to confirm first. Nothing changes until you confirm.

## Common questions

**Can I skip a status?** Follow the order above so the record matches what actually happened.

**The builder wants to cancel after delivery.** Once the booking is `ON_RENT`, it cannot be cancelled.
