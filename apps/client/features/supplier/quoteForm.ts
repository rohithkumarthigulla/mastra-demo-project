import {
  QUOTE_MAX_LINES,
  QUOTE_NOTES_MAX,
  calendarDateSchema,
  quoteLineInputSchema,
  type CreateQuoteRequest,
  type EquipmentUnitDto,
  type QuoteDto,
  type QuoteLineInput,
  type QuoteLineType,
} from '@ee/contracts';
import { parsePrice } from './listingForm';

/** One quote line as typed into the editor. */
export interface QuoteLineDraft {
  /** Stable key for list rendering; never sent. */
  key: string;
  type: QuoteLineType;
  description: string;
  quantity: string;
  unitAmount: string;
}

export interface QuoteDraft {
  equipmentUnitId: string;
  lines: QuoteLineDraft[];
  notes: string;
  validUntil: string;
}

/** Errors keyed by field: `equipmentUnitId`, `lines`, `notes`, `validUntil`, or `lines.<i>.<field>`. */
export type QuoteErrors = Partial<Record<string, string>>;

export const LINE_TYPE_LABELS: Record<QuoteLineType, string> = {
  RENTAL: 'Rental',
  TRANSPORT: 'Transport',
  OPERATOR: 'Operator',
  DEPOSIT: 'Deposit',
  DISCOUNT: 'Discount',
};

let nextKey = 0;
const newKey = () => `line-${++nextKey}`;

export function emptyLine(type: QuoteLineType = 'RENTAL', quantity = 1): QuoteLineDraft {
  return {
    key: newKey(),
    type,
    description: LINE_TYPE_LABELS[type],
    quantity: String(quantity),
    unitAmount: '',
  };
}

/** A fresh quote for a request: one rental line for the request's days at the listing's daily price. */
export function newQuoteDraft(days: number, pricePerDay: number): QuoteDraft {
  return {
    equipmentUnitId: '',
    lines: [{ ...emptyLine('RENTAL', days), unitAmount: String(pricePerDay) }],
    notes: '',
    validUntil: '',
  };
}

export function quoteToDraft(quote: QuoteDto): QuoteDraft {
  return {
    equipmentUnitId: quote.equipmentUnitId ?? '',
    lines: [...quote.lines]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        key: newKey(),
        type: line.type,
        description: line.description,
        quantity: String(line.quantity),
        unitAmount: String(line.unitAmount),
      })),
    notes: quote.notes ?? '',
    validUntil: quote.validUntil ?? '',
  };
}

function parseQuantity(text: string): number {
  return /^\s*\d+\s*$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * Lines that are complete enough to price, for the live preview. Lines with an unparsable
 * quantity or amount are skipped rather than counted as zero.
 */
export function previewableLines(lines: QuoteLineDraft[]) {
  return lines
    .map((line) => ({
      type: line.type,
      quantity: parseQuantity(line.quantity),
      unitAmount: parsePrice(line.unitAmount),
    }))
    .filter((line) => Number.isFinite(line.quantity) && Number.isFinite(line.unitAmount));
}

export interface ParsedQuote {
  equipmentUnitId: string | null;
  lines: QuoteLineInput[];
  notes: string | null;
  validUntil: string | null;
}

export type QuoteFormResult = { ok: true; value: ParsedQuote } | { ok: false; errors: QuoteErrors };

/** Validates the draft with the contract's line rules; enough to save it as a draft. */
export function validateQuoteDraft(draft: QuoteDraft): QuoteFormResult {
  const errors: QuoteErrors = {};
  const lines: QuoteLineInput[] = [];

  if (draft.lines.length === 0) errors.lines = 'Add at least one line.';
  if (draft.lines.length > QUOTE_MAX_LINES) {
    errors.lines = `A quote has at most ${QUOTE_MAX_LINES} lines.`;
  }

  draft.lines.forEach((line, index) => {
    const parsed = quoteLineInputSchema.safeParse({
      type: line.type,
      description: line.description,
      quantity: parseQuantity(line.quantity),
      unitAmount: parsePrice(line.unitAmount),
    });
    if (parsed.success) {
      lines.push(parsed.data);
      return;
    }
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      const key = `lines.${index}.${field}`;
      errors[key] ??= LINE_FIELD_MESSAGES[field] ?? issue.message;
    }
  });

  const notes = draft.notes.trim();
  if (notes.length > QUOTE_NOTES_MAX) {
    errors.notes = `Notes can be at most ${QUOTE_NOTES_MAX} characters.`;
  }
  const validUntil = draft.validUntil.trim();
  if (validUntil && !calendarDateSchema.safeParse(validUntil).success) {
    errors.validUntil = 'Enter a date as YYYY-MM-DD.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      equipmentUnitId: draft.equipmentUnitId || null,
      lines,
      notes: notes || null,
      validUntil: validUntil || null,
    },
  };
}

const LINE_FIELD_MESSAGES: Record<string, string> = {
  description: 'Describe this line (up to 200 characters).',
  quantity: 'Quantity must be a whole number from 1 to 366.',
  unitAmount: 'Enter an amount in rupees, e.g. 12500.',
};

/**
 * Everything {@link validateQuoteDraft} checks, plus what sending needs: at least one
 * `RENTAL` line and a chosen machine.
 */
export function validateQuoteForSend(draft: QuoteDraft): QuoteFormResult {
  const result = validateQuoteDraft(draft);
  const errors: QuoteErrors = result.ok ? {} : { ...result.errors };
  if (!draft.lines.some((line) => line.type === 'RENTAL')) {
    errors.lines ??= 'Add a rental line before sending.';
  }
  if (!draft.equipmentUnitId) errors.equipmentUnitId = 'Choose the machine you will send.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return result;
}

/** Body for creating a quote; the create endpoint takes omitted fields rather than nulls. */
export function toCreateQuote(rentalRequestId: string, quote: ParsedQuote): CreateQuoteRequest {
  return {
    rentalRequestId,
    lines: quote.lines,
    ...(quote.equipmentUnitId ? { equipmentUnitId: quote.equipmentUnitId } : {}),
    ...(quote.notes ? { notes: quote.notes } : {}),
    ...(quote.validUntil ? { validUntil: quote.validUntil } : {}),
  };
}

export interface MachineChoice {
  value: string;
  label: string;
  description: string;
}

/**
 * Machine options for a quote: free machines first, then busy ones marked as such. `free`
 * is null when availability is unknown (the calendar couldn't cover the dates), in which
 * case every machine is offered without a note.
 */
export function machineChoices(
  units: Pick<EquipmentUnitDto, 'id' | 'label' | 'modelYear' | 'model' | 'yard'>[],
  free: Set<string> | null,
): MachineChoice[] {
  const choice = (unit: (typeof units)[number], busy: boolean): MachineChoice => ({
    value: unit.id,
    label: unit.label ?? `${unit.model.modelName} (${unit.modelYear})`,
    description: busy ? `${unit.yard.name} · busy on some of these days` : unit.yard.name,
  });
  if (!free) return units.map((unit) => choice(unit, false));
  return [
    ...units.filter((u) => free.has(u.id)).map((u) => choice(u, false)),
    ...units.filter((u) => !free.has(u.id)).map((u) => choice(u, true)),
  ];
}
