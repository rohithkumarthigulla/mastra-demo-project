import { describe, expect, it } from 'vitest';
import { quoteFixture, unitFixture } from './fixtures';
import {
  emptyLine,
  machineChoices,
  toCreateQuote,
  newQuoteDraft,
  previewableLines,
  quoteToDraft,
  validateQuoteDraft,
  validateQuoteForSend,
  type QuoteDraft,
} from './quoteForm';
import { previewTotals } from './quoteMath';

const UNIT = '22222222-2222-4222-8222-222222222222';

function draft(overrides: Partial<QuoteDraft> = {}): QuoteDraft {
  return { ...newQuoteDraft(5, 12500), equipmentUnitId: UNIT, ...overrides };
}

describe('newQuoteDraft', () => {
  it('starts with a rental line for the request days at the daily price', () => {
    const value = newQuoteDraft(5, 12500);
    expect(value.lines).toHaveLength(1);
    expect(value.lines[0]).toMatchObject({ type: 'RENTAL', quantity: '5', unitAmount: '12500' });
    expect(value.equipmentUnitId).toBe('');
  });
});

describe('validateQuoteDraft', () => {
  it('parses lines, notes and validity', () => {
    const result = validateQuoteDraft(
      draft({
        lines: [
          { ...emptyLine('RENTAL', 5), unitAmount: '₹12,500' },
          { ...emptyLine('DISCOUNT'), unitAmount: '500.50' },
        ],
        notes: '  Includes fuel  ',
        validUntil: '2026-10-15',
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        equipmentUnitId: UNIT,
        lines: [
          { type: 'RENTAL', description: 'Rental', quantity: 5, unitAmount: 12500 },
          { type: 'DISCOUNT', description: 'Discount', quantity: 1, unitAmount: 500.5 },
        ],
        notes: 'Includes fuel',
        validUntil: '2026-10-15',
      },
    });
  });

  it('saves without a machine or a rental line', () => {
    const result = validateQuoteDraft(
      draft({ equipmentUnitId: '', lines: [{ ...emptyLine('TRANSPORT'), unitAmount: '4000' }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.equipmentUnitId).toBeNull();
  });

  it('reports errors per line field', () => {
    const result = validateQuoteDraft(
      draft({
        lines: [
          { ...emptyLine('RENTAL'), quantity: '0', unitAmount: '12500' },
          { ...emptyLine('TRANSPORT'), description: '', quantity: '1.5', unitAmount: 'abc' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'lines.0.quantity',
      'lines.1.description',
      'lines.1.quantity',
      'lines.1.unitAmount',
    ]);
  });

  it('rejects an empty quote and a bad validity date', () => {
    const result = validateQuoteDraft(draft({ lines: [], validUntil: '15/10/2026' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.lines).toBeDefined();
    expect(result.errors.validUntil).toBeDefined();
  });
});

describe('validateQuoteForSend', () => {
  it('passes a complete quote', () => {
    expect(validateQuoteForSend(draft()).ok).toBe(true);
  });

  it('needs a rental line', () => {
    const result = validateQuoteForSend(
      draft({ lines: [{ ...emptyLine('TRANSPORT'), unitAmount: '4000' }] }),
    );
    expect(result).toEqual({ ok: false, errors: { lines: 'Add a rental line before sending.' } });
  });

  it('needs a machine', () => {
    const result = validateQuoteForSend(draft({ equipmentUnitId: '' }));
    expect(result).toEqual({
      ok: false,
      errors: { equipmentUnitId: 'Choose the machine you will send.' },
    });
  });

  it('keeps draft errors alongside the send checks', () => {
    const result = validateQuoteForSend(
      draft({ equipmentUnitId: '', lines: [{ ...emptyLine('RENTAL'), unitAmount: '' }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['equipmentUnitId', 'lines.0.unitAmount']);
  });
});

describe('quoteToDraft', () => {
  it('round-trips a saved quote in line order and previews the server totals', () => {
    const quote = quoteFixture({
      equipmentUnitId: UNIT,
      notes: 'Fuel extra',
      validUntil: '2026-10-15',
      lines: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          type: 'DEPOSIT',
          description: 'Deposit',
          quantity: 1,
          unitAmount: 25000,
          amount: 25000,
          position: 1,
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          type: 'RENTAL',
          description: 'Rental',
          quantity: 5,
          unitAmount: 12500,
          amount: 62500,
          position: 0,
        },
      ],
      subtotal: 62500,
      taxAmount: 11250,
      depositAmount: 25000,
      total: 98750,
    });
    const value = quoteToDraft(quote);
    expect(value.lines.map((line) => line.type)).toEqual(['RENTAL', 'DEPOSIT']);
    expect(value).toMatchObject({ equipmentUnitId: UNIT, notes: 'Fuel extra' });

    const totals = previewTotals(previewableLines(value.lines));
    expect(totals).toEqual({
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      depositAmount: quote.depositAmount,
      total: quote.total,
    });
  });
});

describe('previewableLines', () => {
  it('skips lines that cannot be priced yet', () => {
    const lines = [
      { ...emptyLine('RENTAL', 2), unitAmount: '100' },
      { ...emptyLine('TRANSPORT'), unitAmount: '' },
      { ...emptyLine('OPERATOR'), quantity: 'x', unitAmount: '50' },
    ];
    expect(previewableLines(lines)).toEqual([{ type: 'RENTAL', quantity: 2, unitAmount: 100 }]);
  });
});

describe('machineChoices', () => {
  const a = unitFixture();
  const b = unitFixture({ id: '33333333-3333-4333-8333-333333333333', label: null });

  it('lists free machines first and marks busy ones', () => {
    expect(machineChoices([a, b], new Set([b.id]))).toEqual([
      { value: b.id, label: '3DX (2021)', description: 'Kompally yard' },
      { value: a.id, label: 'Unit A', description: 'Kompally yard · busy on some of these days' },
    ]);
  });

  it('offers every machine plainly when availability is unknown', () => {
    expect(machineChoices([a, b], null).map((c) => c.description)).toEqual([
      'Kompally yard',
      'Kompally yard',
    ]);
  });
});

describe('toCreateQuote', () => {
  const lines = [
    { type: 'RENTAL' as const, description: 'Rental', quantity: 5, unitAmount: 12500 },
  ];
  const REQUEST = '44444444-4444-4444-8444-444444444444';

  it('omits blank optional fields', () => {
    expect(
      toCreateQuote(REQUEST, { equipmentUnitId: null, lines, notes: null, validUntil: null }),
    ).toEqual({ rentalRequestId: REQUEST, lines });
  });

  it('keeps filled optional fields', () => {
    expect(
      toCreateQuote(REQUEST, {
        equipmentUnitId: UNIT,
        lines,
        notes: 'Operator included',
        validUntil: '2026-10-15',
      }),
    ).toEqual({
      rentalRequestId: REQUEST,
      equipmentUnitId: UNIT,
      lines,
      notes: 'Operator included',
      validUntil: '2026-10-15',
    });
  });
});
