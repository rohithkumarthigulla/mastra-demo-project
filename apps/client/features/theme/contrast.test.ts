import { describe, expect, it } from 'vitest';
import { darkTheme, lightTheme, type Theme } from './tokens';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as [string, Theme][])('%s theme contrast (WCAG AA)', (_, { colors, tones }) => {
  const pages = [colors.background, colors.surface];

  it.each(['text', 'textMuted', 'link', 'danger'] as const)('%s is readable on pages', (key) => {
    for (const page of pages) expect(contrast(colors[key], page)).toBeGreaterThanOrEqual(TEXT);
  });

  it('onPrimary is readable on primary', () => {
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(TEXT);
  });

  it('control outlines are distinguishable', () => {
    for (const page of pages) {
      expect(contrast(colors.borderStrong, page)).toBeGreaterThanOrEqual(NON_TEXT);
    }
  });

  it('primary fills are distinguishable on surface', () => {
    expect(contrast(colors.primary, colors.surface)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each(['neutral', 'positive', 'warning'] as const)('%s badge text is readable', (tone) => {
    expect(contrast(tones[tone].text, tones[tone].background)).toBeGreaterThanOrEqual(TEXT);
  });
});
