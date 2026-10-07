const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const radius = { sm: 6, md: 10 } as const;
const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 } as const;

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    onPrimary: string;
    danger: string;
  };
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
}

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#f6f7f9',
    surface: '#ffffff',
    text: '#14171c',
    textMuted: '#5b6472',
    border: '#d5d9e0',
    primary: '#e0761a',
    onPrimary: '#ffffff',
    danger: '#c62828',
  },
  spacing,
  radius,
  fontSize,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#101317',
    surface: '#1a1e24',
    text: '#eef0f3',
    textMuted: '#9aa3b1',
    border: '#2f353e',
    primary: '#f08a2e',
    onPrimary: '#14171c',
    danger: '#ef5350',
  },
  spacing,
  radius,
  fontSize,
};
