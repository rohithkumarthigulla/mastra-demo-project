/**
 * Which drawing stands in for a machine with no photo, and the soft field it sits on.
 * Import-free so it runs under vitest.
 */
export type ArtKind =
  'excavator' | 'miniExcavator' | 'wheelLoader' | 'backhoe' | 'telehandler' | 'roller' | 'generic';

const BY_CODE: Record<string, ArtKind> = {
  EXCAVATOR: 'excavator',
  MINI_EXCAVATOR: 'miniExcavator',
  WHEEL_LOADER: 'wheelLoader',
  BACKHOE_LOADER: 'backhoe',
  TELEHANDLER: 'telehandler',
  ROLLER: 'roller',
};

/** Checked in order, so "mini excavator" wins over "excavator" and "backhoe loader" over "loader". */
const BY_WORD: [RegExp, ArtKind][] = [
  [/\bmini[\s-]?(excavator|digger)\b/, 'miniExcavator'],
  [/\bbackhoe\b|\b3cx\b/, 'backhoe'],
  [/\btele[\s-]?handler\b/, 'telehandler'],
  [/\b(roller|compactor)\b/, 'roller'],
  [/\b(wheel[\s-]?loader|loader)\b/, 'wheelLoader'],
  [/\b(excavator|digger)\b/, 'excavator'],
];

/**
 * The category code decides when the screen has it; otherwise the title is read for the
 * machine's name, since request, quote, booking and fleet summaries carry only a title.
 */
export function artKindFor({
  categoryCode,
  title,
}: {
  categoryCode?: string | null;
  title?: string | null;
}): ArtKind {
  const byCode = categoryCode ? BY_CODE[categoryCode.trim().toUpperCase()] : undefined;
  if (byCode) return byCode;
  const text = (title ?? '').toLowerCase();
  for (const [pattern, kind] of BY_WORD) {
    if (pattern.test(text)) return kind;
  }
  return 'generic';
}

const TINTS: Record<ArtKind, { light: string; dark: string }> = {
  excavator: { light: '#fbe9c3', dark: '#2a2214' },
  miniExcavator: { light: '#fbe9c3', dark: '#2a2214' },
  backhoe: { light: '#dcedc8', dark: '#1a2617' },
  wheelLoader: { light: '#fde1cf', dark: '#2c1d15' },
  telehandler: { light: '#d5e6f5', dark: '#152230' },
  roller: { light: '#e0e7ea', dark: '#1a2226' },
  generic: { light: '#e7eaef', dark: '#2a3039' },
};

export function artTint(kind: ArtKind, dark: boolean): string {
  return dark ? TINTS[kind].dark : TINTS[kind].light;
}

/** How much of the frame the drawing fills; the mini excavator reads smaller than its big sibling. */
export function artScale(kind: ArtKind): number {
  return kind === 'miniExcavator' ? 0.78 : 1;
}

const NAMES: Record<ArtKind, string> = {
  excavator: 'an excavator',
  miniExcavator: 'a mini excavator',
  backhoe: 'a backhoe loader',
  wheelLoader: 'a wheel loader',
  telehandler: 'a telehandler',
  roller: 'a roller',
  generic: 'a machine',
};

export function artAccessibilityLabel(kind: ArtKind, title?: string | null): string {
  return title ? `Drawing of ${NAMES[kind]}: ${title}` : `Drawing of ${NAMES[kind]}`;
}
