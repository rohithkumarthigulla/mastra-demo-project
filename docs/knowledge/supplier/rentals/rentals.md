---
language: en
audience: SUPPLIER
domain: RENTALS
topic: rentals.supplier
sourceType: internal
---

# Your rentals

This page explains a rental from your side as a supplier: what you do at each step, and when you are committed.

## The five steps

1. **Request.** A builder sends a rental request for one of your Active listings, with a start date, an end date and an optional message. It arrives as `PENDING`.
2. **Quote.** You accept the request and prepare a quote, or decline it.
3. **Acceptance.** The builder accepts your sent quote. A booking is created.
4. **Fulfilment.** You deliver the equipment and it is used on site.
5. **Completion.** The equipment comes back and the rental ends.

## When you are committed

Nothing is committed until a builder accepts a quote. Accepting a request, preparing a quote and even sending it do not create a booking or reserve a machine.

The moment the builder accepts your `SENT` quote, a booking is created and is already `CONFIRMED`. There is no further step where you confirm it, so only send quotes you are ready to honour.

## Preparing quotes

A quote is made of line items:

- `RENTAL`: the day rate times the rental period. Always present.
- `TRANSPORT`, `OPERATOR`, `DEPOSIT`, `DISCOUNT`: add when they apply.

GST at 18% is added. All amounts are in rupees, with at most two decimal places.

You can edit a quote while it is `DRAFT` or `PENDING_APPROVAL`. Once `SENT`, it is locked. Check every line and the total before sending.

If your listing has a rate card, the system can draft a quote for you. It starts as `PENDING_APPROVAL`. The builder does not see it until you review and send it.

## Running the booking

After acceptance, the booking moves through `CONFIRMED`, `OUT_FOR_DELIVERY`, `ON_RENT` and `RETURNED`. You keep it up to date as the equipment goes out and comes back. See "The booking lifecycle".

A booking can be cancelled only while it is `CONFIRMED` or `OUT_FOR_DELIVERY`. Once it is `ON_RENT`, it runs until the equipment is returned.

## Tips

- Check that a machine is free before sending a quote, because a booking is created the moment the builder accepts.
- Keep blocks up to date so you are not quoting for machines you cannot supply.
- Use the builder's message to decide whether a `TRANSPORT` or `OPERATOR` line is needed.
