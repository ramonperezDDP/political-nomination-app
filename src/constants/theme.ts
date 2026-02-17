import { MD3LightTheme, configureFonts } from 'react-native-paper';

// AMSP Brand Colors
export const brandColors = {
  purple: '#5a3977',
  blue: '#067eba',
  red: '#de482e',
  black: '#000000',
  accentPurple: '#862fc9',
} as const;

// Font configuration — applies Nunito Sans across all MD3 typescale variants
const fontConfig = {
  fontFamily: 'NunitoSans_400Regular',
} as const;

export const amspLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: brandColors.purple,
    onPrimary: '#ffffff',
    primaryContainer: '#eddcff',
    onPrimaryContainer: '#1f0040',
    secondary: brandColors.blue,
    onSecondary: '#ffffff',
    secondaryContainer: '#d0e4ff',
    onSecondaryContainer: '#001d36',
    tertiary: brandColors.red,
    onTertiary: '#ffffff',
    tertiaryContainer: '#ffdad4',
    onTertiaryContainer: '#410001',
    background: '#fdfbff',
    onBackground: '#1b1b1f',
    surface: '#ffffff',
    onSurface: '#1b1b1f',
    surfaceVariant: '#f0e6f6',
    onSurfaceVariant: '#49454e',
    outline: '#7a757f',
    outlineVariant: '#cbc4cf',
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#410002',
    inverseSurface: '#313034',
    inverseOnSurface: '#f4eff4',
    inversePrimary: '#d4bbff',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: '#f8f0ff',
      level2: '#f3eafa',
      level3: '#eee4f5',
      level4: '#ece2f3',
      level5: '#e9def0',
    },
  },
  fonts: configureFonts({ config: fontConfig }),
};
