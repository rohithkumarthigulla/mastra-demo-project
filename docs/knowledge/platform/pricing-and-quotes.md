---
language: en
audience: ALL
domain: PRICING
topic: quotes.overview
sourceType: internal
---

# Pricing and quotes

A quote is the supplier's price for one rental request. The builder sees the full breakdown before deciding whether to accept it.

## Line items

A quote is made of line items. Each item has a type:

| Type        | Required | What it covers                               |
| ----------- | -------- | -------------------------------------------- |
| `RENTAL`    | yes      | the day rate multiplied by the rental period |
| `TRANSPORT` | no       | moving the equipment to and from the site    |
| `OPERATOR`  | no       | a person to run the machine                  |
| `DEPOSIT`   | no       | a deposit held for the rental                |
| `DISCOUNT`  | no       | a reduction in price                         |

Only the `RENTAL` line is always present. The supplier adds the other lines when they apply to this rental.

## GST

GST is charged at 18% and shown on the quote, so the builder sees the price both before and after tax.

## Money

Every amount is in Indian rupees, with at most two decimal places (for example, ₹12,500.50).

## Quote statuses

| Status             | Meaning                                         | Can be edited |
| ------------------ | ----------------------------------------------- | ------------- |
| `DRAFT`            | the supplier is preparing the quote             | yes           |
| `PENDING_APPROVAL` | drafted automatically, waiting for the supplier | yes           |
| `SENT`             | sent to the builder                             | no            |

Once a quote is `SENT` it is locked. Its prices and line items cannot change.

## Automatic drafts

If a listing has a rate card, the system can draft a quote for a request automatically. An automatic draft starts as `PENDING_APPROVAL`. It is never shown to the builder on its own: the supplier reviews it, edits it if needed and sends it. Until the supplier sends it, the builder does not see it.

## Accepting a quote

The builder can accept a `SENT` quote. Acceptance creates a booking immediately, already `CONFIRMED`. Nothing is committed before the builder accepts: a draft or a sent quote does not reserve the machine or bind either side.
