import { describe, expect, it } from 'vitest';
import { artAccessibilityLabel, artKindFor, artScale, artTint, type ArtKind } from './categoryArt';

describe('artKindFor', () => {
  it.each<[string, ArtKind]>([
    ['EXCAVATOR', 'excavator'],
    ['MINI_EXCAVATOR', 'miniExcavator'],
    ['WHEEL_LOADER', 'wheelLoader'],
    ['BACKHOE_LOADER', 'backhoe'],
    ['TELEHANDLER', 'telehandler'],
    ['ROLLER', 'roller'],
  ])('maps the %s category', (code, kind) => {
    expect(artKindFor({ categoryCode: code })).toBe(kind);
  });

  it('ignores case and whitespace in the code', () => {
    expect(artKindFor({ categoryCode: ' wheel_loader ' })).toBe('wheelLoader');
  });

  it('prefers the category code over the title', () => {
    expect(artKindFor({ categoryCode: 'ROLLER', title: 'CAT 320 excavator' })).toBe('roller');
  });

  it.each<[string, ArtKind]>([
    ['CAT 320 excavator with operator option', 'excavator'],
    ['JCB 3CX backhoe loader', 'backhoe'],
    ['JCB 3CX for site clearing', 'backhoe'],
    ['Komatsu PC210 excavator', 'excavator'],
    ['JCB 540-140 telehandler', 'telehandler'],
    ['Kubota mini excavator', 'miniExcavator'],
    ['Mini-digger for trenches', 'miniExcavator'],
    ['Volvo L90 wheel loader', 'wheelLoader'],
    ['Smooth drum roller', 'roller'],
    ['Plate compactor', 'roller'],
  ])('reads "%s" from the title', (title, kind) => {
    expect(artKindFor({ title })).toBe(kind);
  });

  it('falls back to the generic drawing for an unknown code and title', () => {
    expect(artKindFor({ categoryCode: 'CRANE', title: 'Tower crane' })).toBe('generic');
    expect(artKindFor({})).toBe('generic');
    expect(artKindFor({ categoryCode: null, title: null })).toBe('generic');
  });
});

describe('artTint', () => {
  it('differs between light and dark', () => {
    expect(artTint('excavator', false)).not.toBe(artTint('excavator', true));
  });

  it('gives the mini excavator the excavator field', () => {
    expect(artTint('miniExcavator', false)).toBe(artTint('excavator', false));
  });
});

describe('artScale', () => {
  it('draws the mini excavator smaller', () => {
    expect(artScale('miniExcavator')).toBeLessThan(artScale('excavator'));
    expect(artScale('generic')).toBe(1);
  });
});

describe('artAccessibilityLabel', () => {
  it('names the machine and the listing', () => {
    expect(artAccessibilityLabel('backhoe', 'JCB 3CX')).toBe(
      'Drawing of a backhoe loader: JCB 3CX',
    );
    expect(artAccessibilityLabel('generic')).toBe('Drawing of a machine');
  });
});
