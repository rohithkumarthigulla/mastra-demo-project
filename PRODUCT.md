# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One Expo / React Native codebase (`apps/client`) ships to iOS, Android and web. Every surface must work on all three; screens switch to multi-column layouts at a 768 pt window width (`WIDE_BREAKPOINT` in `apps/client/features/ui/useIsWide.ts`).

## Users

- **Builders**: construction companies and contractors who need heavy equipment (excavators, backhoe loaders, cranes and similar) for a job on specific dates in a specific city. They browse the catalogue, request a machine, compare and accept supplier quotes, track bookings, and post a requirement to several suppliers at once. They are often on a phone, on or near a site, between other tasks.
- **Suppliers**: equipment rental firms that list machines, manage their fleet, yards and availability, and answer requests with quotes.

The builder side (`apps/client/app/(builder)/`) is the main path through the product. The supplier side (`apps/client/app/(supplier)/`) uses the same theme and UI primitives.

## Product Purpose

EquipmentExchange is a marketplace for renting construction equipment in Indian cities. It replaces phone calls and WhatsApp back-and-forth with one flow: request → quote → booking → on hire → returned. Success means a builder can find a free machine, get a priced quote and confirm a booking without leaving the app, and both sides can always see what stage a rental is at.

## Positioning

The listings are backed by real fleet data. A request is checked against the machines the supplier actually has free on those dates, and a requirement only goes to suppliers with a matching unit available. The marketplace never offers something it can't book.

## Operating Context

- Rental flow and stages: `docs/rental-flow.md`; requirements (multi-supplier requests): `docs/requirements.md`.
- Prices are in Indian rupees (₹), quoted per day, with GST shown separately in estimates and quote breakdowns.
- Dates follow the rental time zone (`todayInRentalZone`) and appear as ranges with a day count.
- Notifications (quotes, declines, booking confirmations) show in a feed and on a header bell.
- An optional AI assistant answers equipment questions for builders and acts on the fleet for suppliers. It never acts without explicit confirmation (`docs/assistants.md`, `docs/knowledge/`).
- Voice input and multiple languages are supported in the assistant (`apps/client/features/vocabulary`).

## Capabilities and Constraints

- Stack: Expo + expo-router, React Native, TanStack Query, Zod contracts shared from `packages/contracts`. No UI kit and no custom fonts: styling is inline React Native styles reading `useTheme()` tokens from `apps/client/features/theme/tokens.ts`.
- Light and dark themes follow the OS colour scheme. There is no in-app toggle.
- Status vocabulary (request, quote, booking and requirement statuses) comes from the contracts and is mapped to labels and tones in `apps/client/features/progress/stages.ts`.
- New dependencies need a stated reason.

## Brand Commitments

- Name: **EquipmentExchange**. App icon and splash use deep blue `#1f4e79`.
- In-app accent: construction orange (light `#e0761a`, dark `#f08a2e`). Keep the hue; change only how it is paired to meet contrast.
- Voice: plain, short, practical English ("Find equipment", "Accept a supplier's quote…", "No machine free on your dates"). No marketing language inside the app.

## Evidence on Hand

- Hyderabad demo data (`pnpm --filter @ee/api demo:hyderabad`): two suppliers (Deccan Earthmovers, Charminar Cranes & Loaders), two builders (Gachibowli Constructions, Kukatpally Infra), listings with placeholder photos, and requests and bookings at every stage. Guided tour in `docs/walkthrough.md`.
- There are no real customer testimonials, metrics or photography. Don't make them up.

## Product Principles

1. **Always show the stage.** Every request, quote and booking says where it is in the rental flow and what happens next.
2. **Only offer what can be booked.** Availability and price are shown before the builder commits, and the UI never implies a machine is free when it isn't.
3. **One clear next action.** Each screen has one primary action; everything else is secondary.
4. **Built for the site, not the desk.** Large tap targets, readable text in daylight, and layouts that hold up on a small Android phone as well as a desktop browser.
5. **The same product on every platform.** iOS, Android and web share behaviour and tokens. Platform differences are limited to native controls and safe areas.

## Accessibility & Inclusion

- Target: WCAG 2.2 AA. Text contrast ≥ 4.5:1 (≥ 3:1 for large text), control boundaries and state indicators ≥ 3:1, enforced for theme tokens by `apps/client/features/theme/contrast.test.ts`.
- Touch targets ≥ 44 × 44 pt on every interactive element.
- Interactive elements set `accessibilityRole` and state (`selected`, `checked`, `disabled`, `busy`); errors use `accessibilityRole="alert"`; live availability uses `aria-live="polite"`.
- Status is never shown by colour alone: badges carry a text label and stage bars carry a text step.
