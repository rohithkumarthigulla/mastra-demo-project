---
language: en
audience: ALL
domain: RENTALS
topic: rentals.overview
sourceType: internal
---

# How rentals work

EquipmentExchange connects builders who need construction equipment with suppliers who own it. Every rental follows the same five steps: request, quote, acceptance, fulfilment and completion.

## 1. Request

A builder finds a published listing and sends a rental request. The request names the listing, a start date, an end date and, if the builder wants, a short message. A new request has the status `PENDING`.

The supplier then accepts or declines the request. Declining ends it. Accepting means the supplier is willing to prepare a price.

## 2. Quote

The supplier prepares a quote: the price for this rental, broken into line items. Every quote has a `RENTAL` line (the day rate times the rental period) and can also include transport, an operator, a deposit or a discount. GST at 18% is added on top.

While the quote is a draft, the supplier can change it as often as needed. When it is ready, the supplier sends it to the builder. A sent quote is locked and can no longer be edited.

## 3. Acceptance

The builder reviews the sent quote and accepts it. Nothing is committed before this point: until a builder accepts a quote, neither side has agreed to a rental, and the machine is not booked.

Accepting the quote creates a booking straight away, with the status `CONFIRMED`. There is no separate step where the supplier confirms the booking again.

## 4. Fulfilment

The supplier delivers the equipment and the booking moves through its stages:

- `CONFIRMED`: the booking exists and is waiting for delivery.
- `OUT_FOR_DELIVERY`: the equipment is on its way to the site.
- `ON_RENT`: the equipment is at the site and in use.

## 5. Completion

When the rental period ends and the equipment comes back, the booking becomes `RETURNED`. The rental is then complete.

## Cancelling

A booking can be cancelled only while it is `CONFIRMED` or `OUT_FOR_DELIVERY`. Once the equipment is on rent, the booking can no longer be cancelled; it continues until the equipment is returned.

## Money

All amounts are in Indian rupees, with at most two decimal places.
