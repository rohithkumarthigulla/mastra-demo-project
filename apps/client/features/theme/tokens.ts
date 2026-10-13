const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const radius = { sm: 6, md: 10 } as const;
const fontSize = { xs: 11, sm: 13, md: 16, lg: 20, xl: 28 } as const;
const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
/** Minimum hit area for anything tappable (WCAG 2.5.8 / platform guidelines), and the narrow content column. */
const size = { touch: 44, column: 420 } as const;

/** Background/text pair for a status badge. */
export interface Tone {
  background: string;
  text: string;
}

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    /** Decorative dividers and card outlines. */
    border: string;
    /** Outlines that identify a control (inputs, checkboxes, unselected chips); ≥ 3:1 against surface. */
    borderStrong: string;
    /** Brand accent for fills: primary buttons, selected chips, progress. Not for text on the page. */
    primary: string;
    onPrimary: string;
    /** Accent for text on background/surface (links, prices); the primary hue at ≥ 4.5:1. */
    link: string;
    danger: string;
  };
  tones: { neutral: Tone; positive: Tone; warning: Tone };
  /**
   * The bottom navigation bar: the one translucent, floating surface. `tint` at
   * `tintOpacity` sits over the blur and alone keeps tab labels at AA over any content.
   */
  glass: {
    tint: string;
    tintOpacity: number;
    border: string;
    /** The droplet behind the active tab. */
    bubble: string;
    bubbleOpacity: number;
    active: string;
    inactive: string;
  };
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  size: typeof size;
}

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#f6f7f9',
    surface: '#ffffff',
    text: '#14171c',
    textMuted: '#5b6472',
    border: '#d5d9e0',
    borderStrong: '#737c8a',
    primary: '#e0761a',
    onPrimary: '#14171c',
    link: '#a8520c',
    danger: '#c62828',
  },
  tones: {
    neutral: { background: '#e7eaef', text: '#3b4350' },
    positive: { background: '#dcf2e1', text: '#1b6b32' },
    warning: { background: '#fdecd9', text: '#8a4a0c' },
  },
  glass: {
    tint: '#ffffff',
    tintOpacity: 0.82,
    border: '#d5d9e0',
    bubble: '#fdecd9',
    bubbleOpacity: 0.95,
    active: '#8a4a0c',
    inactive: '#4a5361',
  },
  spacing,
  radius,
  fontSize,
  fontWeight,
  size,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#101317',
    surface: '#1a1e24',
    text: '#eef0f3',
    textMuted: '#9aa3b1',
    border: '#2f353e',
    borderStrong: '#6b7380',
    primary: '#f08a2e',
    onPrimary: '#14171c',
    link: '#f08a2e',
    danger: '#ef5350',
  },
  tones: {
    neutral: { background: '#2a3039', text: '#c4cad4' },
    positive: { background: '#173823', text: '#7fd897' },
    warning: { background: '#3d2a14', text: '#f5b56e' },
  },
  glass: {
    tint: '#1a1e24',
    tintOpacity: 0.85,
    border: '#3a414b',
    bubble: '#3d2a14',
    bubbleOpacity: 0.95,
    active: '#f5b56e',
    inactive: '#aab2bf',
  },
  spacing,
  radius,
  fontSize,
  fontWeight,
  size,
};
