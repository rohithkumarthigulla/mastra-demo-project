import { todayInRentalZone } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import {
  draftToRequirementParams,
  emptyRequirementForm,
  requirementFormFromParams,
  validateRequirementForm,
} from './requirementForm';

const today = todayInRentalZone();
const valid = {
  ...emptyRequirementForm(today),
  title: 'Excavator for foundation work',
  categoryCode: 'EXCAVATOR',
  cityGeoId: 'IN-MH-PUNE',
};

describe('validateRequirementForm', () => {
  it('accepts a minimal requirement and omits empty optional fields', () => {
    const result = validateRequirementForm(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Excavator for foundation work',
        categoryCode: 'EXCAVATOR',
        cityGeoId: 'IN-MH-PUNE',
        startDate: today,
        endDate: today,
        quantity: 1,
      },
    });
  });

  it('parses quantity, budget with grouping, and trims notes', () => {
    const result = validateRequirementForm({
      ...valid,
      quantity: '3',
      budgetPerDay: '₹12,500',
      notes: '  Night shift  ',
    });
    expect(result.ok && result.value).toMatchObject({
      quantity: 3,
      budgetPerDay: 12500,
      notes: 'Night shift',
    });
  });

  it('reports friendly messages for missing pickers and bad numbers', () => {
    const result = validateRequirementForm({
      ...emptyRequirementForm(today),
      title: 'ab',
      quantity: '25',
      budgetPerDay: 'lots',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'budgetPerDay',
      'categoryCode',
      'cityGeoId',
      'quantity',
      'title',
    ]);
    expect(result.errors.categoryCode).toBe('Choose an equipment category.');
  });

  it('uses the shared date wording', () => {
    const result = validateRequirementForm({ ...valid, startDate: '2000-01-01', endDate: 'soon' });
    expect(result).toEqual({
      ok: false,
      errors: {
        startDate: 'Start date can’t be in the past.',
        endDate: 'Enter a date as YYYY-MM-DD.',
      },
    });
  });
});

describe('assistant draft handoff', () => {
  it('carries every draft field through route params into a valid form', () => {
    const params = draftToRequirementParams({
      title: 'Excavator for foundation work',
      categoryCode: 'EXCAVATOR',
      equipmentModelId: null,
      constructionTaskCode: null,
      cityGeoId: 'IN-MH-PUNE',
      startDate: today,
      endDate: today,
      quantity: 2,
      notes: 'Rocky soil',
    });
    const form = requirementFormFromParams(params, today);
    expect(form).toMatchObject({ quantity: '2', notes: 'Rocky soil', cityGeoId: 'IN-MH-PUNE' });
    expect(validateRequirementForm(form, today).ok).toBe(true);
  });

  it('leaves fields the assistant did not fill at their defaults', () => {
    const params = draftToRequirementParams({
      title: 'Crane',
      categoryCode: 'CRANE',
      equipmentModelId: null,
      constructionTaskCode: null,
      cityGeoId: null,
      startDate: null,
      endDate: null,
      quantity: 1,
      notes: null,
    });
    expect(params).toEqual({ title: 'Crane', categoryCode: 'CRANE', quantity: '1' });
    expect(requirementFormFromParams(params, today)).toEqual({
      ...emptyRequirementForm(today),
      title: 'Crane',
      categoryCode: 'CRANE',
    });
  });
});
