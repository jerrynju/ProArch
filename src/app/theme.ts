// Material 3 tokens lifted from the design file.

export const M3 = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  surface: '#FEF7FF',
  surfaceLow: '#F7F2FA',
  surfaceContainer: '#F3EDF7',
  outline: '#E6E0E9',
  outlineDim: '#CAC4D0',
  text: '#1D1B20',
  textSecondary: '#49454F',
  textTertiary: '#79747E',
  textFaint: '#B0A9BC',
  error: '#B3261E',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#8C1D18',
  successContainer: '#C8E6C9',
  onSuccessContainer: '#1B5E20',
  passBg: '#F0F7F0',
  failBg: '#FDEEEC',
  star: '#F5B301',
  codeBg: '#1D1B20',
  codeText: '#E8DEF8',
  codeVar: '#B39DDB',
  codeComment: '#79747E',
  codeEm: '#F5EEFF',
};

export interface ShellTheme {
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  track: string;
  contentBg: string;
}

export function shellTheme(dark: boolean): ShellTheme {
  return dark
    ? { surface: '#1D1B20', border: '#49454F', text: '#E6E0E9', textSecondary: '#CAC4D0', track: '#2B2930', contentBg: '#141218' }
    : { surface: '#FEF7FF', border: '#E6E0E9', text: '#1D1B20', textSecondary: '#79747E', track: '#F3EDF7', contentBg: '#FEF7FF' };
}
