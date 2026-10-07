import type { CalendarDate, QuoteLineInput, QuoteStatus } from '@ee/contracts';
import { eq } from 'drizzle-orm';
import { quoteLines, quotes } from '../../../platform/database/schema';
import { toNumericString } from '../../../platform/money';
import type { Executor } from '../../availability/infrastructure/busy-units';
import { priceLines, quoteTotals } from '../domain/totals';

export interface NewQuote {
  rentalRequestId: string;
  supplierProfileId: string;
  equipmentUnitId: string | null;
  status: Extract<QuoteStatus, 'DRAFT' | 'PENDING_APPROVAL'>;
  autoDrafted: boolean;
  notes: string | null;
  validUntil: CalendarDate | null;
  lines: readonly QuoteLineInput[];
}

function totalColumns(lines: readonly QuoteLineInput[]) {
  const priced = priceLines(lines);
  const totals = quoteTotals(priced);
  return {
    priced,
    columns: {
      subtotal: toNumericString(totals.subtotal),
      taxPercent: toNumericString(totals.taxPercent),
      taxAmount: toNumericString(totals.taxAmount),
      depositAmount: toNumericString(totals.depositAmount),
      total: toNumericString(totals.total),
    },
  };
}

async function insertLines(
  db: Executor,
  quoteId: string,
  priced: ReturnType<typeof priceLines>,
): Promise<void> {
  // Stored unsigned (the column is checked >= 0); DISCOUNT is negated when read.
  await db.insert(quoteLines).values(
    priced.map((line) => ({
      quoteId,
      type: line.type,
      description: line.description,
      quantity: line.quantity,
      unitAmount: toNumericString(line.unitAmount),
      amount: toNumericString(Math.abs(line.amount)),
      position: line.position,
    })),
  );
}

/** Inserts a quote with its lines and server-computed totals; returns the new id. */
export async function insertQuote(db: Executor, quote: NewQuote, now: Date): Promise<string> {
  const { priced, columns } = totalColumns(quote.lines);
  const [row] = await db
    .insert(quotes)
    .values({
      rentalRequestId: quote.rentalRequestId,
      supplierProfileId: quote.supplierProfileId,
      equipmentUnitId: quote.equipmentUnitId,
      status: quote.status,
      autoDrafted: quote.autoDrafted,
      notes: quote.notes,
      validUntil: quote.validUntil,
      ...columns,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: quotes.id });
  await insertLines(db, row!.id, priced);
  return row!.id;
}

/** Replaces every line of a quote and recomputes its totals. */
export async function replaceQuoteLines(
  db: Executor,
  quoteId: string,
  lines: readonly QuoteLineInput[],
  now: Date,
): Promise<void> {
  const { priced, columns } = totalColumns(lines);
  await db.delete(quoteLines).where(eq(quoteLines.quoteId, quoteId));
  await insertLines(db, quoteId, priced);
  await db
    .update(quotes)
    .set({ ...columns, updatedAt: now })
    .where(eq(quotes.id, quoteId));
}
