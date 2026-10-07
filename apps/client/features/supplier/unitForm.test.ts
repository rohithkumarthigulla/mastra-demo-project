import { describe, expect, it } from 'vitest';
import { unitFixture } from './fixtures';
import {
  emptyUnitForm,
  groupUnitsByListing,
  unitName,
  unitToForm,
  validateNewUnit,
  validateUnitChanges,
  validateYard,
} from './unitForm';

const LISTING = '11111111-1111-4111-8111-111111111111';
const YARD = '33333333-3333-4333-8333-333333333333';

describe('validateNewUnit', () => {
  it('builds a create body, trimming and dropping blank identifiers', () => {
    const form = emptyUnitForm(LISTING);
    const result = validateNewUnit({
      ...form,
      yardId: YARD,
      modelYear: ' 2021 ',
      condition: 'GOOD',
      label: '  ',
      identifiers: { ...form.identifiers, SERIAL_NUMBER: ' SN-1 ' },
    });
    expect(result).toEqual({
      ok: true,
      value: {
        listingId: LISTING,
        yardId: YARD,
        modelYear: 2021,
        condition: 'GOOD',
        identifiers: [{ type: 'SERIAL_NUMBER', value: 'SN-1' }],
      },
    });
  });

  it('explains every missing field', () => {
    const result = validateNewUnit({ ...emptyUnitForm(), modelYear: '21' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'condition',
      'listingId',
      'modelYear',
      'yardId',
    ]);
    expect(result.errors.modelYear).toBe('Enter a year between 1950 and 2100.');
  });
});

describe('validateUnitChanges', () => {
  it('returns null when nothing changed', () => {
    const unit = unitFixture();
    expect(validateUnitChanges(unit, unitToForm(unit))).toEqual({ ok: true, value: null });
  });

  it('sends only changed fields, clearing the label with null', () => {
    const unit = unitFixture();
    const form = unitToForm(unit);
    expect(validateUnitChanges(unit, { ...form, label: '', condition: 'FAIR' })).toEqual({
      ok: true,
      value: { label: null, condition: 'FAIR' },
    });
  });

  it('sends the whole identifier set when one changes', () => {
    const unit = unitFixture();
    const form = unitToForm(unit);
    const result = validateUnitChanges(unit, {
      ...form,
      identifiers: { ...form.identifiers, ENGINE_NUMBER: 'E-9' },
    });
    expect(result).toEqual({
      ok: true,
      value: {
        identifiers: [
          { type: 'SERIAL_NUMBER', value: 'JCB3DX-0091' },
          { type: 'ENGINE_NUMBER', value: 'E-9' },
        ],
      },
    });
  });
});

describe('validateYard', () => {
  it('accepts a named yard in a city', () => {
    expect(validateYard({ name: ' Kompally ', cityGeoId: 'IN-HYD', address: '' })).toEqual({
      ok: true,
      value: { name: 'Kompally', cityGeoId: 'IN-HYD', address: '' },
    });
  });

  it('asks for a name and city', () => {
    expect(validateYard({ name: '', cityGeoId: '', address: '' })).toEqual({
      ok: false,
      errors: { name: 'Enter a yard name (up to 80 characters).', cityGeoId: 'Choose a city.' },
    });
  });
});

describe('groupUnitsByListing', () => {
  it('groups by listing with active counts, active machines first', () => {
    const retired = unitFixture({
      id: '99999999-9999-4999-8999-999999999999',
      label: 'Aaa',
      status: 'RETIRED',
    });
    const other = unitFixture({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      listing: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Ace crane' },
    });
    const groups = groupUnitsByListing([retired, unitFixture(), other]);
    expect(groups.map((g) => [g.listing.title, g.active, g.units.map(unitName)])).toEqual([
      ['Ace crane', 1, ['Unit A']],
      ['JCB 3DX backhoe loader', 1, ['Unit A', 'Aaa']],
    ]);
  });

  it('names unlabelled machines by model and year', () => {
    expect(unitName(unitFixture({ label: null }))).toBe('3DX (2021)');
  });
});
